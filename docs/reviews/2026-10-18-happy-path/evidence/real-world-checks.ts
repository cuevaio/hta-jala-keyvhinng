import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../../../src/db/schema';
import { createParticipationRepository } from '../../../../src/modules/sessions/infrastructure/participation.repository';
import { createSessionRepository } from '../../../../src/modules/sessions/infrastructure/session.repository';
import { createPartyRepository } from '../../../../src/modules/parties/infrastructure/party.repository';
import { createMatchingRepository } from '../../../../src/modules/matching/infrastructure/matching.repository';
import { createMatchingApplication } from '../../../../src/modules/matching/application/matching.service';
import { createRoadMatchingService } from '../../../../src/modules/matching/domain/road-matching';
import { selfieDataUrl } from '../../../../tests/fixtures/selfie';

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 8 });
const db = drizzle(sql, {schema});
const repo = createParticipationRepository(db);
const ids = Array.from({length:4},()=>crypto.randomUUID());
const sessions: string[] = [];
const input = {selfieDataUrl, displayName:'Review fixture', originLabel:'Fictional pickup 123', originLatitude:-12, originLongitude:-77, destinationLabel:'Fictional private home 456', latitude:-12.1, longitude:-77.03, delegatePreference:'delegate' as const, departInMinutes:0 as const};
const engine = createRoadMatchingService({
  estimateMatrix: async points => ({durationsSeconds: points.map(()=>points.map(()=>100))}),
  estimateDuration: async()=>100, estimateDistance:async()=>1000,
  estimateRoute:async points=>({legs:points.slice(1).map((to,i)=>({from:points[i],to,distanceMeters:1000,durationSeconds:100})), totalDistanceMeters:(points.length-1)*1000,totalDurationSeconds:(points.length-1)*100})
});
const matching = createMatchingApplication(createMatchingRepository(db),engine,'review-fixture');
try {
  await db.insert(schema.users).values(ids.map(id=>({id,displayName:'Review fixture'})));
  const s = await repo.createGroup(ids[0],input); sessions.push(s.id);
  const publicSession = await createSessionRepository(db).findById(s.id);
  console.log('PUBLIC_EXACT_DESTINATION', JSON.stringify({label:publicSession?.destinationLabel,point:publicSession?.destination}));
  await repo.join(s.id, ids[1], {...input,delegatePreference:'passenger'});
  await matching.match(s.id,ids[0]);
  const parties = createPartyRepository(db);
  for(const id of ids.slice(0,2)) await parties.apply(s.id,id,'confirm');
  await parties.apply(s.id,ids[0],'start');
  await parties.apply(s.id,ids[0],'complete');
  console.log('SELFIE_RETAINED_AFTER_COMPLETION',Boolean(await repo.selfieFor(s.id,ids[1],(await repo.waitingRoom(s.id,ids[0])).me.id)));
  try {await repo.join(s.id,ids[0],input);console.log('COMPLETED_POOL_REJOIN','succeeded');} catch(e) {console.log('COMPLETED_POOL_REJOIN',(e as {code:string}).code);}
  let release!: () => void;
  let locked!: () => void;
  const lockedReady = new Promise<void>(r => {locked=r;});
  const releaseReady = new Promise<void>(r => {release=r;});
  const blocker = db.transaction(async tx => {
    await tx.select().from(schema.users).where(eq(schema.users.id,ids[0])).for('update');
    locked(); await releaseReady;
  });
  await lockedReady;
  const pending = Promise.allSettled([repo.createGroup(ids[0],input),repo.createGroup(ids[0],input)]);
  await sql`SELECT pg_sleep(0.5)`;
  release(); await blocker;
  const outcomes = await pending;
  for(const outcome of outcomes) if(outcome.status==='fulfilled') sessions.push(outcome.value.id);
  const waiting = await db.select({session:schema.sessionParticipants.sessionId}).from(schema.sessionParticipants).where(and(eq(schema.sessionParticipants.userId,ids[0]),eq(schema.sessionParticipants.status,'waiting')));
  console.log('CONCURRENT_CREATES',JSON.stringify({outcomes:outcomes.map(r=>r.status),waitingPoolCount:waiting.length}));
  for(let i=0;i<waiting.length;i++) await repo.join(waiting[i].session,ids[i+2],{...input,delegatePreference:'passenger'});
  await Promise.all(waiting.map(w=>matching.match(w.session,ids[0])));
  const assigned = await db.select({party:schema.ridePartyMembers.partyId}).from(schema.ridePartyMembers).innerJoin(schema.rideParties,eq(schema.rideParties.id,schema.ridePartyMembers.partyId)).where(and(eq(schema.ridePartyMembers.userId,ids[0]),eq(schema.rideParties.status,'forming')));
  console.log('SAME_ACCOUNT_LIVE_PARTIES',assigned.length);
} finally {
  for(const id of sessions) await db.delete(schema.sessions).where(eq(schema.sessions.id,id));
  for(const id of ids) await db.delete(schema.users).where(eq(schema.users.id,id));
  await sql.end();
}

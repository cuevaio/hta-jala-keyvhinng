# Jala — Comparte el taxi al salir

**Track:** Movilidad y Transporte · **App:** https://jala.oak4.xyz

## Problema

Lima es la ciudad del mundo donde más horas se pierden en el tráfico (TomTom Traffic Index 2025). Aun así, cuando cientos de personas salen a la misma hora de una universidad, un concierto, un mall o una estación, cada una pide su propio taxi hacia la misma zona. Viajar solo es caro, y de noche, inseguro. Compartir el viaje sería más barato, pero hoy solo pasa entre conocidos: no hay una forma rápida de encontrar a otras personas compatibles, acordar la ruta y saber cuánto paga cada una.

## Para quién

Estudiantes y trabajadores en Lima que hacen un viaje próximo desde un punto concentrado. Proponemos un piloto con un solo lugar y una franja horaria, para que haya suficientes personas al mismo tiempo.

## Cómo funciona

1. Inicias sesión e indicas desde dónde sales, a dónde vas y cuándo: lo antes posible o en 15, 30 o 60 minutos.
2. Jala te pone en una **sala** con personas que salen cerca (1.5 km), van hacia un destino cercano (3 km) y parten a una hora parecida. Si no hay ninguna, crea una sala nueva.
3. El emparejamiento es automático. Forma grupos de 2 a 4 personas con **tiempos reales por calle** (OSRM), y nadie se desvía más de **5 minutos** frente a ir solo.
4. El grupo ve el orden de paradas, la ruta en el mapa y cuánto le toca a cada persona: cada tramo se divide entre quienes siguen a bordo. También puede chatear, compartir una selfie validada con detección de rostro para reconocerse y recibir notificaciones push.
5. Una persona del grupo se ofrece a pedir el taxi en su app de siempre. Todos confirman y luego inician y terminan el viaje. Si nadie confirma a tiempo, el grupo vence y las personas vuelven a buscar.

Jala **no** opera vehículos ni cobra el taxi; solo coordina. El modelo es de créditos: los primeros 5 viajes son gratis, después S/ 1 por pasajero, y quien pide el taxi no paga comisión.

## Evidencia

- **11 personas registradas** y **5 grupos formados** en la app en producción, durante el evento.
- Ejemplo de reparto: un taxi de S/ 28.50 de Parque Kennedy a Barranco, compartido entre 2: una persona paga S/ 10.50 (37 %) y la otra S/ 18.00, según el tramo que recorre cada una.

## Decisiones técnicas

- **Stack:** Next.js 16, React 19, TypeScript y Drizzle sobre Postgres (Neon), en Vercel. Sesiones propias con contraseñas scrypt y tokens hasheados, además de Google OAuth.
- **Emparejamiento:** prueba todos los órdenes de paradas posibles para grupos de 2 a 4 dentro de lotes de 12 personas, y luego elige los grupos de forma greedy: primero los más grandes y con menos desvío. No promete el óptimo global. Si el servidor de rutas falla, no inventa rutas en línea recta. El reparto usa puntos básicos y siempre suma 100 %.
- **Entrega segura:** CI corre lint, typecheck, 280 pruebas (unitarias y de integración sobre Postgres) y verifica que el esquema coincida con las migraciones. Luego migra la base y despliega **sin promover**. La versión nueva solo recibe tráfico si pasa un smoke test, que incluye un health check de la versión del esquema. Las migraciones solo agregan, así la versión anterior sigue funcionando durante el cambio.
- **Privacidad:** la dirección y la selfie solo las ve tu grupo. Los logs registran cada request e interacción sin emails, direcciones, coordenadas ni mensajes.

## Limitaciones

- La demanda y el ahorro real aún no están validados con suficientes usuarios. Falta comparar tarifas compartidas reales con cotizaciones individuales.
- El emparejamiento necesita varias personas en el mismo lugar y a la misma hora. Con poco uso, muchas salas quedan con una sola persona.
- La app no reserva ni cobra el taxi, y no hay recarga de créditos.
- No hay verificación de identidad, calificaciones ni reportes. La selfie confirma que hay un rostro, no quién es.
- El ruteo (OSRM) y la búsqueda de direcciones (Photon/Nominatim) usan servidores públicos de demostración.
- En iPhone, las notificaciones push requieren instalar la app en la pantalla de inicio.

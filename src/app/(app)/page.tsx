import { googleSignInHref } from "@/components/auth/google-href";
import { PassengerJourney } from "@/components/journey/passenger-journey";

export default function HomePage() {
  return <PassengerJourney googleHref={googleSignInHref("/")} />;
}

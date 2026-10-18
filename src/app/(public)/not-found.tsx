import { NotFoundMessage } from "@/components/layout/not-found-message";

// notFound() in a public page renders inside the public layout, which has the chrome.
export default function NotFound() {
  return <NotFoundMessage />;
}

// Production builds come only from the CI release job, which migrates the
// database first and promotes the deployment only after it passes its smoke
// test. A build started any other way (`vercel --prod` from a laptop, a
// dashboard redeploy, a Git integration build) could ship code ahead of its
// schema, so it fails here instead.
if (
  process.env.VERCEL_ENV === "production" &&
  process.env.JALA_RELEASE !== "ci"
) {
  console.error(
    "Production builds run only from GitHub Actions (push to main). See README › Production deployment.",
  );
  process.exit(1);
}

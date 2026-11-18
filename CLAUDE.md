# HR Arcade

Static site (no build) served by GitHub Pages from `main`. Bump the `?v=N` on module imports when changing them
(Pages caches for ~10 minutes).

## UI changes: verify before handing over

Run `python verify/run.py` after any UI change, fix every failure, then look at the screenshots in `verify/out/`
against the taste rubric. Details, checks and the rubric: [VERIFY.md](VERIFY.md).
Never point tests at the real Firebase; test mode (`?test=1`) uses the mocks in `verify/mocks/`.

## PTR (test server) before live

Changes go to the `ptr` branch first. Every push to `ptr` publishes to https://hr-arcade-ptr.web.app with its own
database (Firebase project `hr-arcade-ptr`, see `.github/workflows/ptr.yml`), so testing never touches live saves,
leaderboards or the office fund. Test there on a phone, then open one release PR from `ptr` into `main` (live).
The PTR shows a top strip and a test-coins button; both exist only on the PTR host.


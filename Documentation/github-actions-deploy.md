# GitHub Actions Deployment

This project can be tested and deployed with GitHub Actions using GitHub Pages.

## What the workflow does

- Validates that the static frontend files exist
- Runs a smoke test for the navigation chatbot
- Starts a local static server in CI
- Verifies the homepage responds correctly
- Deploys `FrontEnd/html` to GitHub Pages on pushes to `main`

## Workflow File

- `.github/workflows/deploy-pages.yml`

## How to enable deployment

1. Push this repository to GitHub.
2. Open the repository settings.
3. Go to `Settings -> Pages`.
4. Under `Build and deployment`, set `Source` to `GitHub Actions`.
5. Push to `main` or run the workflow manually from the `Actions` tab.

## Expected Result

After a successful run, GitHub Pages will publish the contents of `FrontEnd/html`.
The workflow summary will include the live site URL.

## What is being tested

The workflow currently checks:

- `index.html` exists
- `style.css` exists
- `app.js` exists
- chatbot markup exists in the homepage
- chatbot logic exists in the script
- homepage can be served locally in CI

## Suggested Next Improvement

If you want stronger UI validation, the next step is adding a browser-based Playwright test that:

- opens the deployed homepage
- clicks the chatbot button
- sends a prompt like `Take me to discounts`
- verifies the chatbot panel opens and responds correctly

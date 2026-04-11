# Implementation Plan: StudentHelper

## Overview

The core HTML/CSS/JS implementation is already built in `FrontEnd/html/`. These tasks cover verifying and completing the implementation against the requirements, setting up a property-based test harness using fast-check, and writing all 16 correctness properties plus supporting unit tests. All code is vanilla JavaScript (ES6+) with no build step.

## Tasks

- [ ] 1. Verify and complete static HTML structure
  - Confirm `lang="en"` on `<html>` and `<meta name="viewport">` are present — _Requirements: 8.1, 8.2_
  - Confirm all 10 category `<section>` elements exist with the correct IDs: `study-tools`, `ai-tools`, `productivity`, `note-taking`, `coding`, `design`, `scholarships`, `learning`, `discounts`, `useful` — _Requirements: 1.1_
  - Confirm sticky header contains logo, 10 nav anchor links, and `#themeToggle` with `aria-label` — _Requirements: 1.4, 8.3_
  - Confirm hero section has `h1`, subtitle `<p>`, and `#searchInput` — _Requirements: 1.5_
  - Confirm footer contains site name and `hello@studenthelper.dev` contact link — _Requirements: 1.6_
  - Confirm `#fabSubmit` FAB is present — _Requirements: 5.1_
  - Confirm `#submitOverlay` has `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="modalTitle"` — _Requirements: 8.4, 8.5_
  - Confirm `#adminOverlay` has `role="dialog"` and `aria-modal="true"` — _Requirements: 8.4_
  - Confirm all static `.card` elements have `target="_blank"` and `rel="noopener"` — _Requirements: 1.3, 8.6_
  - Move the two modal `<div>` blocks and the FAB `<button>` from below `</html>` to inside `<body>` before `</body>` — _Requirements: 8.1_
  - _Requirements: 1.1–1.6, 8.1–8.6_

- [ ] 2. Verify and complete app.js — Theme_Controller
  - Confirm theme is read from `localStorage` before DOMContentLoaded and applied as `data-theme` on `<html>` — _Requirements: 3.4_
  - Confirm default is `"dark"` when no key is stored — _Requirements: 3.1_
  - Confirm toggle switches between `"dark"` and `"light"`, persists to `localStorage["theme"]`, and updates the button icon (🌙 / ☀️) — _Requirements: 3.2, 3.3, 3.5_
  - _Requirements: 3.1–3.5_

- [ ] 3. Verify and complete app.js — Search_Engine
  - Confirm search index is built from DOM at DOMContentLoaded by reading `.category` sections — _Requirements: 2.1_
  - Confirm `renderResults()` filters case-insensitively across title, desc, tag, and category — _Requirements: 2.2_
  - Confirm "No results found." message appears when `matches.length === 0` — _Requirements: 2.3_
  - Confirm dropdown is hidden and cleared when input is empty — _Requirements: 2.4_
  - Confirm clicking outside `.search-wrap` hides the dropdown — _Requirements: 2.5_
  - Confirm re-focusing a non-empty input re-displays results — _Requirements: 2.6_
  - Confirm all search result `<a>` elements have `target="_blank"` and `rel="noopener"` — _Requirements: 2.7, 8.6_
  - _Requirements: 2.1–2.7_

- [ ] 4. Verify and complete app.js — Submission_System
  - Confirm FAB click removes `hidden` from `#submitOverlay` — _Requirements: 5.2_
  - Confirm close button and overlay-click call `closeSubmitModal()` which resets all fields and hides errors/success — _Requirements: 5.9_
  - Confirm description `<textarea>` `input` event updates `#descCount` to `"N / 160"` format — _Requirements: 5.4_
  - Confirm valid form submission saves a `status: "pending"` object to `localStorage["sh_submissions"]` and shows `#formSuccess` — _Requirements: 5.5_
  - Confirm empty required field shows inline error and does not save — _Requirements: 5.6_
  - Confirm invalid URL shows error message mentioning `https://` and does not save — _Requirements: 5.7_
  - Confirm "Submit another" button calls `resetForm()` — _Requirements: 5.8_
  - _Requirements: 5.1–5.9_

- [ ] 5. Verify and complete app.js — Admin_Panel
  - Confirm `keydown` listener buffers last 5 characters (ignoring INPUT/TEXTAREA focus) and opens admin modal when buffer equals `"admin"` — _Requirements: 6.1_
  - Confirm modal opens showing login screen with password cleared — _Requirements: 6.9_
  - Confirm incorrect password shows `#adminLoginError` and does not reveal `#adminPanel` — _Requirements: 6.3_
  - Confirm correct password (`studenthelper2024`) hides login and shows `#adminPanel` with three tabs — _Requirements: 6.2, 6.4_
  - Confirm `renderAdminPanel()` renders stats row with correct pending/approved/rejected counts — _Requirements: 6.5_
  - Confirm "Approve" button calls `reviewSubmission(id, 'approved')`, updates localStorage, re-renders panel on Pending tab, and calls `renderApprovedCommunityCards()` — _Requirements: 6.6_
  - Confirm "Reject" button calls `reviewSubmission(id, 'rejected')` and updates localStorage — _Requirements: 6.7_
  - Confirm each submission card displays title, URL, description, category, tag, optional email, date, and status badge — _Requirements: 6.8_
  - Confirm closing and re-opening admin modal resets to login screen — _Requirements: 6.9_
  - _Requirements: 6.1–6.9_

- [ ] 6. Verify and complete app.js — Community_Card_Renderer
  - Confirm `renderApprovedCommunityCards()` is called on page load — _Requirements: 7.1_
  - Confirm approved submissions are injected as `.community-card` elements into the correct `#sectionId .cards` container — _Requirements: 7.1, 7.2_
  - Confirm each community card shows title, description, tag, and a "👥 Community" badge — _Requirements: 7.3_
  - Confirm community card `<a>` has `target="_blank"` and `rel="noopener"` — _Requirements: 7.4, 8.6_
  - Confirm function first removes all existing `.community-card` elements before re-injecting — _Requirements: 7.5_
  - Confirm submissions with an unrecognised category are silently skipped — _Requirements: 7.6_
  - _Requirements: 7.1–7.6_

- [ ] 7. Verify CSS — Responsive layout and theme system
  - Confirm CSS custom properties cover all theme-dependent colours under `:root` (dark) and `[data-theme="light"]` — _Requirements: 8.8_
  - Confirm `.cards` grid uses `repeat(auto-fill, minmax(260px, 1fr))` for wide viewports — _Requirements: 4.1_
  - Confirm `@media (max-width: 768px)` sets `.cards` to two-column and hides `.nav-links` — _Requirements: 4.2, 4.3_
  - Confirm `@media (max-width: 480px)` sets `.cards` to single column — _Requirements: 4.1_
  - Confirm `.hero h1` uses `clamp()` for fluid font sizing — _Requirements: 4.4_
  - _Requirements: 4.1–4.5, 8.8_

- [ ] 8. Checkpoint — Manual smoke test
  - Open `FrontEnd/html/index.html` in a browser and verify: all 10 category sections render, theme toggle works, search filters cards, FAB opens modal, form validation fires, typing "admin" opens admin panel, and approved submissions appear as community cards.
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Set up property-based test harness
  - Create `FrontEnd/html/tests/` directory
  - Create `FrontEnd/html/tests/package.json` with `fast-check` and a test runner (e.g. vitest or jest) as dev dependencies
  - Create `FrontEnd/html/tests/helpers.js` that exports: `escHtml`, `getSubmissions`/`saveSubmissions` (using a mock localStorage), `renderResults` (pure filter logic extracted from app.js), and a `makeSubmission(overrides)` factory
  - Extract pure functions from `app.js` that are needed for testing (escHtml, filter logic, submission validation) into a testable module or expose them on a test-only export
  - _Requirements: all_

- [ ] 10. Write property-based tests — XSS and card rendering
  - [ ] 10.1 Implement property test for `escHtml` (Property 16)
    - Generate arbitrary strings containing `<`, `>`, `&`, `"` characters
    - Assert raw characters do not appear in output and entities are present
    - **Property 16: XSS prevention via HTML escaping**
    - **Validates: Requirements 8.7**
    - `// Feature: student-helper-docs, Property 16: XSS prevention via HTML escaping`

  - [ ]* 10.2 Write unit tests for `escHtml`
    - Test each special character individually: `<`, `>`, `&`, `"`
    - Test empty string, string with no special chars, mixed string
    - _Requirements: 8.7_

  - [ ] 10.3 Implement property test for card render completeness (Property 1)
    - Generate arbitrary `{ title, desc, tag, href }` objects (desc ≤ 160 chars)
    - Render a card element and assert title text, desc text, tag text, and href are all present
    - **Property 1: Card render completeness**
    - **Validates: Requirements 1.2**
    - `// Feature: student-helper-docs, Property 1: Card render completeness`

  - [ ] 10.4 Implement property test for external link safety (Property 2)
    - Generate arbitrary card/result element sets
    - Assert every `<a>` has `target="_blank"` and `rel="noopener"`
    - **Property 2: External links have noopener**
    - **Validates: Requirements 1.3, 2.7, 7.4, 8.6**
    - `// Feature: student-helper-docs, Property 2: External links have noopener`

- [ ] 11. Write property-based tests — Search_Engine
  - [ ] 11.1 Implement property test for search result subset correctness (Property 3)
    - Generate arbitrary query strings and arrays of card objects
    - Assert every returned result contains the query in at least one field (case-insensitive)
    - **Property 3: Search results are a subset of matching cards**
    - **Validates: Requirements 2.1, 2.2**
    - `// Feature: student-helper-docs, Property 3: Search results are a subset of matching cards`

  - [ ]* 11.2 Write unit tests for `renderResults` filter logic
    - Test empty query returns no results
    - Test non-matching query returns empty array
    - Test match on title, desc, tag, and category independently
    - _Requirements: 2.1–2.4_

- [ ] 12. Write property-based tests — Theme_Controller
  - [ ] 12.1 Implement property test for theme toggle round trip (Property 4)
    - For each starting theme `"dark"` and `"light"`, simulate two toggle clicks
    - Assert `data-theme` and `localStorage["theme"]` return to original value
    - **Property 4: Theme toggle is a round trip**
    - **Validates: Requirements 3.2, 3.3**
    - `// Feature: student-helper-docs, Property 4: Theme toggle is a round trip`

  - [ ] 12.2 Implement property test for theme persistence round trip (Property 5)
    - For each theme value stored in `localStorage["theme"]`, simulate Theme_Controller init
    - Assert `data-theme` attribute matches stored value and icon matches (🌙 for dark, ☀️ for light)
    - **Property 5: Theme persistence round trip**
    - **Validates: Requirements 3.4, 3.5**
    - `// Feature: student-helper-docs, Property 5: Theme persistence round trip`

  - [ ]* 12.3 Write unit tests for Theme_Controller
    - Test default to dark when no localStorage key
    - Test icon is 🌙 for dark and ☀️ for light
    - _Requirements: 3.1, 3.5_

- [ ] 13. Write property-based tests — Submission_System
  - [ ] 13.1 Implement property test for description character counter accuracy (Property 6)
    - Generate arbitrary strings of length 0–160
    - Simulate input event and assert `#descCount` text equals `"N / 160"`
    - **Property 6: Description character counter accuracy**
    - **Validates: Requirements 5.4**
    - `// Feature: student-helper-docs, Property 6: Description character counter accuracy`

  - [ ] 13.2 Implement property test for valid submission saved as pending (Property 7)
    - Generate arbitrary valid submission data (all required fields non-empty, valid URL)
    - Simulate form submit and assert `getSubmissions()` contains the entry with `status: "pending"`
    - **Property 7: Valid submission is saved as pending**
    - **Validates: Requirements 5.5**
    - `// Feature: student-helper-docs, Property 7: Valid submission is saved as pending`

  - [ ] 13.3 Implement property test for invalid submission rejection (Property 8)
    - Generate form submissions with at least one required field empty or an invalid URL
    - Assert submission is not saved to localStorage and error element is visible
    - **Property 8: Invalid submission is rejected**
    - **Validates: Requirements 5.6, 5.7**
    - `// Feature: student-helper-docs, Property 8: Invalid submission is rejected`

  - [ ]* 13.4 Write unit tests for Submission_System
    - Test FAB click shows modal
    - Test close button hides modal and resets form
    - Test "Submit another" resets form after success
    - _Requirements: 5.2, 5.8, 5.9_

- [ ] 14. Write property-based tests — Admin_Panel
  - [ ] 14.1 Implement property test for incorrect password denial (Property 9)
    - Generate arbitrary strings that are not equal to `"studenthelper2024"`
    - Simulate password entry and assert admin panel remains hidden and error is shown
    - **Property 9: Incorrect password denies access**
    - **Validates: Requirements 6.3**
    - `// Feature: student-helper-docs, Property 9: Incorrect password denies access`

  - [ ] 14.2 Implement property test for admin stats accuracy (Property 10)
    - Generate arbitrary arrays of submissions with known pending/approved/rejected counts
    - Call `renderAdminPanel()` and assert stat pills display exactly those counts
    - **Property 10: Admin stats reflect actual submission counts**
    - **Validates: Requirements 6.5**
    - `// Feature: student-helper-docs, Property 10: Admin stats reflect actual submission counts`

  - [ ] 14.3 Implement property test for review action status update (Property 11)
    - Generate arbitrary pending submissions and a target status (`"approved"` or `"rejected"`)
    - Call `reviewSubmission(id, status)` and assert only that submission's status changed in localStorage
    - **Property 11: Review action updates submission status**
    - **Validates: Requirements 6.6, 6.7**
    - `// Feature: student-helper-docs, Property 11: Review action updates submission status`

  - [ ] 14.4 Implement property test for admin card field completeness (Property 12)
    - Generate arbitrary submission objects
    - Call `renderAdminPanel()` and assert rendered card HTML contains title, URL, desc, category, tag, date, and status badge
    - **Property 12: Admin card renders all submission fields**
    - **Validates: Requirements 6.8**
    - `// Feature: student-helper-docs, Property 12: Admin card renders all submission fields`

  - [ ]* 14.5 Write unit tests for Admin_Panel
    - Test typing "admin" opens modal
    - Test closing and re-opening resets to login screen
    - Test correct password reveals review interface with three tabs
    - _Requirements: 6.1, 6.4, 6.9_

- [ ] 15. Write property-based tests — Community_Card_Renderer
  - [ ] 15.1 Implement property test for community card render completeness (Property 13)
    - Generate arbitrary arrays of approved submissions
    - Call `renderApprovedCommunityCards()` and assert each produces a `.community-card` in the correct section with title, desc, tag, and "👥 Community" badge
    - **Property 13: Community card render completeness**
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - `// Feature: student-helper-docs, Property 13: Community card render completeness`

  - [ ] 15.2 Implement property test for idempotent render (Property 14)
    - Generate arbitrary approved submission arrays and a call count N ≥ 1
    - Call `renderApprovedCommunityCards()` N times and assert DOM state equals calling it once (no duplicates)
    - **Property 14: Community card render is idempotent**
    - **Validates: Requirements 7.5**
    - `// Feature: student-helper-docs, Property 14: Community card render is idempotent`

  - [ ] 15.3 Implement property test for unknown category silent skip (Property 15)
    - Generate approved submissions with category values not in `catMap`
    - Call `renderApprovedCommunityCards()` and assert no error is thrown and no card is injected
    - **Property 15: Unknown category is skipped silently**
    - **Validates: Requirements 7.6**
    - `// Feature: student-helper-docs, Property 15: Unknown category is skipped silently`

  - [ ]* 15.4 Write unit tests for Community_Card_Renderer
    - Test community card has `target="_blank"` and `rel="noopener"`
    - Test card is appended to correct section grid
    - _Requirements: 7.4, 8.6_

- [ ] 16. Checkpoint — Run full test suite
  - Run `npx vitest --run` (or equivalent) from `FrontEnd/html/tests/`
  - All property-based tests must pass with ≥ 100 iterations each
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The implementation in `FrontEnd/html/` is largely complete — tasks 1–7 are verification/completion passes
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) with a minimum of 100 iterations per property
- Pure functions (`escHtml`, filter logic, validation) must be extracted or exported from `app.js` to be unit-testable without a browser DOM
- The modal markup currently sits outside `<body>` in `index.html` — task 1 includes fixing this

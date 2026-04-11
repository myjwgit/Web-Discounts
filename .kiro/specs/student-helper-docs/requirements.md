# Requirements Document

## Introduction

StudentHelper is a static, client-side web application that serves as a curated directory of free tools, websites, and resources for students. Inspired by community-driven resource sites like fmhy.net, it organises resources into ten thematic categories and provides live search, dark/light theming, and a community submission workflow — all without a backend server or database. All persistent state is stored in the browser's `localStorage`.

The site is built with plain HTML, CSS, and vanilla JavaScript (no frameworks, no build step). It is designed to be hosted as a static site and to work entirely in the browser.

---

## Glossary

- **Site**: The StudentHelper static web application.
- **Visitor**: Any person who opens the Site in a browser.
- **Resource**: A curated external tool, website, or service listed on the Site.
- **Card**: The visual UI element that represents a single Resource, containing a title, description, tag, and link.
- **Category**: A named group of thematically related Resources (e.g. "Study Tools", "AI Tools").
- **Tag**: A short keyword label attached to a Card (e.g. "Free", "Math", "AI Chat").
- **Search_Engine**: The client-side search component that filters Resources by keyword.
- **Theme_Controller**: The component responsible for toggling and persisting the dark/light colour theme.
- **Submission_Form**: The modal form through which a Visitor proposes a new Resource.
- **Submission**: A pending, approved, or rejected community-proposed Resource stored in `localStorage`.
- **Admin_Panel**: The password-protected review interface for approving or rejecting Submissions.
- **Community_Card**: A Card injected into the page at runtime after a Submission is approved.
- **localStorage**: The browser-native key-value store used to persist theme preference and Submissions.

---

## Requirements

### Requirement 1: Resource Directory

**User Story:** As a student, I want to browse a curated list of free tools and websites organised by category, so that I can quickly find resources relevant to my needs.

#### Acceptance Criteria

1. THE Site SHALL display Resources grouped into the following ten Categories: Study Tools, AI Tools, Productivity Tools, Note-Taking Apps, Coding Resources, Design Resources, Scholarship / Internship Resources, Free Learning Websites, Student Discounts, and Useful Websites.
2. THE Site SHALL render each Resource as a Card containing a title, a short description (≤ 160 characters), a Tag, and a hyperlink to the external resource.
3. WHEN a Visitor clicks a Card, THE Site SHALL open the linked external URL in a new browser tab without navigating away from the Site.
4. THE Site SHALL display a sticky header containing the site logo, navigation links to each Category anchor, and the Theme_Controller toggle button.
5. THE Site SHALL display a hero section with a headline, a subtitle, and the Search_Engine input field.
6. THE Site SHALL display a footer with the site name and a contact email address.

---

### Requirement 2: Live Search

**User Story:** As a student, I want to search across all resources by keyword, so that I can find a specific tool without scrolling through every category.

#### Acceptance Criteria

1. WHEN a Visitor types in the search input, THE Search_Engine SHALL filter all Cards and display matching results in a dropdown overlay beneath the input field.
2. THE Search_Engine SHALL match a query against each Card's title, description, Tag, and Category name (case-insensitive).
3. WHEN no Cards match the query, THE Search_Engine SHALL display a "No results found." message in the dropdown.
4. WHEN the search input is empty, THE Search_Engine SHALL hide the dropdown and show no results.
5. WHEN a Visitor clicks outside the search input area, THE Search_Engine SHALL hide the dropdown.
6. WHEN a Visitor focuses the search input and the field is non-empty, THE Search_Engine SHALL re-display the current results.
7. WHEN a Visitor clicks a result in the dropdown, THE Site SHALL open the linked external URL in a new browser tab.

---

### Requirement 3: Dark / Light Theme

**User Story:** As a student, I want to switch between dark and light mode, so that I can use the site comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Site SHALL default to dark mode on first load when no theme preference is stored.
2. WHEN a Visitor clicks the Theme_Controller toggle button, THE Site SHALL switch the active theme between dark and light.
3. WHEN the theme changes, THE Theme_Controller SHALL persist the selected theme value to `localStorage` under the key `"theme"`.
4. WHEN the Site loads, THE Theme_Controller SHALL read the stored theme from `localStorage` and apply it before rendering, so that the Visitor's preference is restored across sessions.
5. WHEN the active theme is dark, THE Theme_Controller SHALL display a moon (🌙) icon on the toggle button; WHEN the active theme is light, THE Theme_Controller SHALL display a sun (☀️) icon.

---

### Requirement 4: Responsive Layout

**User Story:** As a student, I want the site to be usable on any device, so that I can access resources from my phone, tablet, or desktop.

#### Acceptance Criteria

1. THE Site SHALL use a CSS grid layout that renders Cards in multiple columns on wide viewports (≥ 769 px) and in a single column on narrow viewports (≤ 480 px).
2. WHEN the viewport width is between 481 px and 768 px, THE Site SHALL render Cards in a two-column grid.
3. WHEN the viewport width is ≤ 768 px, THE Site SHALL hide the header navigation links to prevent overflow.
4. THE Site SHALL use relative units and `clamp()` for typography so that text scales proportionally across viewport sizes.
5. THE Site SHALL be navigable and fully functional without horizontal scrolling on any viewport width ≥ 320 px.

---

### Requirement 5: Community Resource Submission

**User Story:** As a student, I want to suggest a new resource for the site, so that other students can benefit from tools I have found useful.

#### Acceptance Criteria

1. THE Site SHALL display a floating action button (FAB) labelled "+ Submit" that is always visible in the bottom-right corner of the viewport.
2. WHEN a Visitor clicks the FAB, THE Site SHALL open the Submission_Form in a modal overlay.
3. THE Submission_Form SHALL collect the following fields: Resource Name (required, max 80 characters), URL (required, must be a valid URL), Short Description (required, max 160 characters), Category (required, selected from the ten defined Categories), Tag (required, max 30 characters), and Email (optional).
4. THE Submission_Form SHALL display a live character counter for the description field showing the current count and the 160-character limit.
5. WHEN a Visitor submits the form with all required fields valid, THE Site SHALL save the Submission to `localStorage` with status `"pending"` and display a success confirmation message.
6. IF a required field is empty when the form is submitted, THEN THE Submission_Form SHALL display an inline error message and SHALL NOT save the Submission.
7. IF the URL field contains a value that is not a valid URL, THEN THE Submission_Form SHALL display an error message stating that a valid URL including `https://` is required.
8. WHEN the success confirmation is shown, THE Site SHALL offer a "Submit another" button that resets the form for a new entry.
9. WHEN a Visitor closes the modal (via the close button or by clicking the overlay), THE Submission_Form SHALL reset all fields and hide any error or success messages.

---

### Requirement 6: Admin Review Panel

**User Story:** As the site administrator, I want to review, approve, or reject community submissions, so that only high-quality resources are published to the site.

#### Acceptance Criteria

1. WHEN a Visitor types the word `admin` on the keyboard while no text input or textarea is focused, THE Site SHALL open the Admin_Panel modal.
2. THE Admin_Panel SHALL require a password before granting access to the review interface; the default password SHALL be `studenthelper2024`.
3. IF an incorrect password is entered, THEN THE Admin_Panel SHALL display an "Incorrect password." error message and SHALL NOT grant access.
4. WHEN the correct password is entered, THE Admin_Panel SHALL display the review interface showing all Submissions grouped into three tabs: Pending, Approved, and Rejected.
5. THE Admin_Panel SHALL display a summary row showing the count of Pending, Approved, and Rejected Submissions.
6. WHEN the administrator clicks "Approve" on a pending Submission, THE Site SHALL update the Submission's status to `"approved"` in `localStorage` and re-render the Admin_Panel on the Pending tab.
7. WHEN the administrator clicks "Reject" on a pending Submission, THE Site SHALL update the Submission's status to `"rejected"` in `localStorage` and re-render the Admin_Panel on the Pending tab.
8. THE Admin_Panel SHALL display each Submission's title, URL, description, category, tag, optional email, submission date, and current status badge.
9. WHEN the Admin_Panel is closed and re-opened, THE Site SHALL require the password to be entered again.

---

### Requirement 7: Community Card Rendering

**User Story:** As a student, I want to see community-approved resources displayed alongside the curated ones, so that I can benefit from peer recommendations.

#### Acceptance Criteria

1. WHEN the Site loads, THE Site SHALL read all Submissions from `localStorage` and inject approved Submissions as Community_Cards into the correct Category section.
2. WHEN a Submission is approved via the Admin_Panel, THE Site SHALL immediately inject the corresponding Community_Card into the correct Category section without requiring a page reload.
3. THE Community_Card SHALL display the submitted title, description, and tag, and SHALL include a "👥 Community" badge to distinguish it from curated Cards.
4. WHEN a Visitor clicks a Community_Card, THE Site SHALL open the submitted URL in a new browser tab.
5. WHEN the Site re-renders Community_Cards (e.g. after an approval action), THE Site SHALL first remove all previously injected Community_Cards before re-injecting to prevent duplicates.
6. IF an approved Submission's category does not match any defined Category section, THEN THE Site SHALL silently skip that Submission without throwing an error.

---

### Requirement 8: Accessibility and Security

**User Story:** As a developer, I want the site to follow basic accessibility and security practices, so that it is usable by all students and safe to deploy.

#### Acceptance Criteria

1. THE Site SHALL set `lang="en"` on the root `<html>` element.
2. THE Site SHALL include a `<meta name="viewport">` tag to enable correct scaling on mobile devices.
3. THE Theme_Controller toggle button SHALL have an `aria-label` attribute describing its purpose.
4. THE Admin_Panel modal and Submission_Form modal SHALL each have `role="dialog"` and `aria-modal="true"` attributes.
5. THE Submission_Form modal SHALL have an `aria-labelledby` attribute referencing the modal title element.
6. ALL external links (Cards and search results) SHALL include `rel="noopener"` to prevent reverse tabnapping.
7. WHEN rendering user-submitted content (title, description, URL, tag, email) in the DOM, THE Site SHALL HTML-escape all values to prevent cross-site scripting (XSS) injection.
8. THE Site SHALL use CSS custom properties (variables) for all theme-dependent colour values so that the entire theme can be switched by changing a single `data-theme` attribute on the `<html>` element.

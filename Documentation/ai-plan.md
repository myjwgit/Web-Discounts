# AI Feature Plan Document

## Document Purpose

This document defines a practical plan for adding AI capabilities to the StudentHelper project. The goal is to introduce AI in a way that directly improves discount discovery and business value without requiring a full platform rewrite.

## Recommended AI Feature

### Primary Feature
**AI-Powered Discount Recommendations and Search Assistant**

This feature adds an AI layer that helps students discover the most relevant discounts based on profile, search intent, browsing behavior, location context, and stated preferences.

### Why This Feature First

This is the best initial AI feature for the current project because it aligns directly with existing requirements:
- Requirement 2: Discount Discovery
- Requirement 6: Search and Filtering
- Requirement 7: Notifications and Alerts
- Requirement 8: Analytics and Reporting
- Future enhancement already mentioned in `design.md`: AI-powered recommendations

It also delivers visible user value quickly while avoiding high-risk AI workflows such as automated business decisioning or unsupported financial actions.

## Product Goals

### Student Goals
- Help students find relevant discounts faster.
- Reduce effort when searching across categories and businesses.
- Surface discounts that match student interests and usage patterns.
- Improve mobile discovery with contextual recommendations.

### Business Goals
- Improve discount visibility for the right audience.
- Increase redemption rates.
- Provide businesses with insight into why discounts are or are not being recommended.

### Platform Goals
- Increase engagement, search success, and redemption conversion.
- Build an AI foundation that can later support smarter notifications, business insights, and conversational discovery.

## Scope

### In Scope for Phase 1
- Personalized discount recommendation feed for students.
- AI-assisted search ranking.
- Natural-language search input such as "cheap food near campus" or "laptop discounts for engineering students".
- Recommendation explanation text such as "Recommended because you liked food deals and this offer is near your location."
- Basic recommendation analytics.

### Out of Scope for Phase 1
- Generative chatbot with multi-turn memory.
- Automated business pricing suggestions shown publicly.
- Fully autonomous notifications.
- OCR-based student ID verification.
- Payment-related AI decisions.

## User Stories

### Student-Facing Stories
1. As a student, I want recommended discounts on the home page so I can find useful offers quickly.
2. As a student, I want to search in natural language so I do not need exact keywords.
3. As a student, I want to understand why a discount was recommended so I can trust the result.
4. As a student, I want recommendations to avoid expired offers so I only see valid discounts.

### Business-Facing Stories
1. As a business, I want my discounts recommended to relevant students so conversion improves.
2. As a business, I want analytics on recommendation impressions, clicks, and redemptions.

### Admin and Platform Stories
1. As a platform operator, I want recommendation logic to be measurable and safe.
2. As a platform operator, I want fallback behavior when AI services are unavailable.

## Acceptance Criteria

### Recommendation Feed
1. When a verified student opens the dashboard, the system shall return personalized discount recommendations.
2. When insufficient profile data exists, the system shall fall back to category popularity, location, and active discounts.
3. When a discount is expired or exhausted, the system shall not recommend it.
4. When a recommendation is shown, the system shall store an impression event for analytics.
5. When a student clicks a recommendation, the system shall log engagement for future ranking improvement.

### Natural-Language Search
1. When a student enters a natural-language query, the system shall convert it into structured filters and ranking signals.
2. When the query includes location intent, the system shall prefer nearby valid discounts.
3. When the query includes category or product intent, the system shall prioritize matching categories and tags.
4. When the AI parser fails, the system shall fall back to standard keyword search.
5. When results are displayed, the system shall indicate that AI ranking or AI interpretation was used when applicable.

### Explanation and Transparency
1. When the system recommends a discount, it shall provide a short explanation generated from non-sensitive input signals.
2. The system shall not expose private user data in recommendation explanations.
3. The system shall allow disabling personalized recommendations from user preferences.

## Proposed AI Architecture

### High-Level Approach
Use a hybrid recommendation architecture:
- Rules-based filtering for hard constraints
- Retrieval and ranking for candidate discounts
- LLM or lightweight AI model for query understanding and explanation generation
- Heuristic or ML ranking layer for personalization

### Architecture Components
1. **Recommendation Service**
   - Builds candidate discount lists
   - Scores items based on user profile, behavior, category preferences, and location

2. **Search Interpretation Service**
   - Converts natural-language search to structured search parameters
   - Extracts category, location intent, price intent, urgency, and business name hints

3. **Explanation Service**
   - Produces concise explanation strings for recommendations
   - Uses safe templates or LLM output constrained by policy

4. **Analytics Feedback Service**
   - Collects impressions, clicks, saves, and redemptions
   - Supports future ranking improvements

### Suggested Data Flow
1. Student opens dashboard or search page.
2. Frontend calls recommendation or AI search endpoint.
3. Backend loads user profile, preferences, active discounts, and recent activity.
4. Recommendation service filters invalid offers.
5. AI layer interprets intent or helps rank candidates.
6. Backend returns ranked discounts plus explanation metadata.
7. Frontend renders results and logs interactions.

## Integration with Current Architecture

Based on the current design document, the project already targets:
- React frontend
- Node.js/Express backend
- PostgreSQL
- Redis

The AI feature should fit into that architecture as follows:

### Frontend Changes
Add new UI modules for:
- Recommended discounts section on homepage/dashboard
- Natural-language search input
- Recommendation explanation badges
- Feedback actions such as "Not relevant"

### Backend Changes
Add backend modules such as:
- `RecommendationService`
- `AiSearchService`
- `ExplanationService`
- `InteractionTrackingService`

### Database Changes
Add storage for:
- user_preference_signals
- recommendation_impressions
- recommendation_clicks
- saved_searches
- search_queries
- optional discount_embeddings or ranking metadata

## API Plan

### New Endpoints
```http
GET  /api/ai/recommendations
POST /api/ai/search
POST /api/ai/feedback
GET  /api/business/ai-analytics
```

### Example Responsibilities
- `GET /api/ai/recommendations`
  - Returns ranked active discounts for the current student.
- `POST /api/ai/search`
  - Accepts free-text query and optional filters.
  - Returns interpreted filters, ranked discounts, and explanation metadata.
- `POST /api/ai/feedback`
  - Records whether a recommendation was helpful, clicked, dismissed, or saved.
- `GET /api/business/ai-analytics`
  - Shows recommendation impressions, CTR, saves, and redemption influence.

## Data Model Additions

### Suggested Tables

#### recommendation_events
```sql
CREATE TABLE recommendation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  discount_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  source VARCHAR(50) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### search_sessions
```sql
CREATE TABLE search_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  raw_query TEXT NOT NULL,
  interpreted_filters JSONB,
  results_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### user_interest_profiles
```sql
CREATE TABLE user_interest_profiles (
  user_id UUID PRIMARY KEY,
  top_categories JSONB,
  top_tags JSONB,
  preferred_radius_km INTEGER,
  profile_version INTEGER DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## AI Model Strategy

### Phase 1 Recommendation
Use a layered approach instead of training a custom model immediately.

1. **Deterministic layer**
   - Remove expired, exhausted, or inaccessible discounts.
   - Apply student eligibility and distance constraints.

2. **Heuristic ranking layer**
   - Score by category affinity, proximity, popularity, recency, and business quality signals.

3. **LLM-assisted layer**
   - Interpret free-text search.
   - Generate short recommendation explanations.
   - Optionally enrich tags for discounts.

### Provider Abstraction
Do not hardcode one AI vendor into business logic. Add an adapter such as:
- `AiProvider`
- `AiSearchInterpreter`
- `AiExplanationGenerator`

This will allow switching providers later.

## Security and Privacy Requirements

1. Do not send passwords, payment data, or unnecessary personal data to the AI provider.
2. Minimize prompts to only required context.
3. Log AI requests in a privacy-safe form.
4. Add fallback behavior when the AI provider is unavailable.
5. Allow users to opt out of personalized recommendations.
6. Do not use protected attributes for unfair ranking decisions.
7. Store analytics and feedback using least-privilege access.

## Risk Assessment

### Product Risks
- Recommendations may feel inaccurate for new users.
- Natural-language search may misinterpret vague queries.
- Explanations may sound generic if ranking signals are weak.

### Technical Risks
- AI latency can slow down search responses.
- External AI provider outages can break the feature if no fallback exists.
- Incomplete event tracking weakens recommendation quality.

### Mitigations
- Use graceful fallback to standard search and trending discounts.
- Cache frequent search interpretations.
- Start with template-based explanations if model quality is inconsistent.
- Instrument analytics before tuning ranking.

## Implementation Plan

### Phase 0: Discovery and Design
- Confirm the first AI feature as recommendations plus AI search.
- Define success metrics.
- Finalize event taxonomy for impressions, clicks, saves, and redemptions.
- Add architecture decision record for AI provider abstraction.

### Phase 1: Data Foundation
- Add tracking tables and backend event logging.
- Capture user interactions in frontend and backend.
- Create user interest profile generation job.

### Phase 2: Backend AI Services
- Build recommendation candidate pipeline.
- Implement heuristic ranking.
- Add AI search interpretation endpoint.
- Add fallback logic when AI parsing fails.

### Phase 3: Frontend Experience
- Add recommended section to homepage.
- Add natural-language search box.
- Show recommendation reasons.
- Add student feedback controls.

### Phase 4: Business Analytics
- Add AI influence metrics for businesses.
- Track recommendation-to-redemption funnel.
- Add internal dashboards for tuning.

### Phase 5: Optimization
- Tune ranking weights.
- Add caching and latency budgets.
- Evaluate embedding-based retrieval or a learned ranking model.

## Delivery Milestones

### Milestone 1
- Recommendation events stored
- Basic heuristic recommendations returned by API
- Frontend recommended list visible

### Milestone 2
- Natural-language search working
- Fallback keyword search implemented
- Explanation text displayed

### Milestone 3
- Business AI analytics available
- User feedback loop stored
- Metrics dashboard defined

## Success Metrics

### Student Metrics
- Increased click-through rate on recommended discounts
- Increased redemption rate from homepage visits
- Reduced time-to-first-click after search
- Higher repeat usage of search and saved discounts

### Business Metrics
- Increased impressions for relevant discounts
- Improved redemption conversion for recommended offers
- Better analytics visibility into offer performance

### Technical Metrics
- Recommendation response time under target threshold
- AI search fallback success rate
- Low error rate on AI endpoints

## Testing Plan

### Unit Tests
- Query interpretation fallback rules
- Recommendation scoring logic
- Explanation sanitization

### Integration Tests
- Recommendation API with seeded discounts
- Search endpoint with structured and natural-language queries
- Event tracking correctness

### End-to-End Tests
- Student receives recommendations on dashboard
- Student searches using natural language
- Student clicks recommended discount and event is logged

### Safety Tests
- Expired discounts are never returned
- Disabled personalization users receive non-personalized results
- Sensitive data is excluded from AI requests

## Recommended File and Module Additions

### Documentation
- `Documentation/ai-plan.md`
- `Documentation/ai-api-spec.md`
- `Documentation/ai-risk-register.md`

### Backend
- `backend/src/modules/ai/`
- `backend/src/modules/recommendations/`
- `backend/src/modules/analytics/`

### Frontend
- `frontend/src/components/AiSearchBar.tsx`
- `frontend/src/components/RecommendedDiscounts.tsx`
- `frontend/src/services/ai.ts`

## Future AI Extensions

After Phase 1 succeeds, the platform can extend into:
- Smart notification timing
- Business offer optimization suggestions
- AI-generated campaign summaries
- Conversational discount assistant
- Moderation support for business-submitted content

## Final Recommendation

The first AI feature for StudentHelper should be a hybrid recommendation and AI search system. It directly improves the core student journey, fits the existing requirements, and creates reusable infrastructure for future AI features.

The project should avoid starting with a broad chatbot. A focused recommendation and search feature is simpler to ship, easier to measure, and better aligned with the current architecture and business goals.

// Side-effect registrations. Import this once at orchestrator boot.

// existing retrieval
import "./retrieval/query-defects";
import "./retrieval/query-claims";
import "./retrieval/trace-batch";
import "./retrieval/weekly-quality-summary";
import "./retrieval/semantic-search-signals";

// new retrieval
import "./retrieval/pareto-defect-codes";
import "./retrieval/bom-parts-for-product";
import "./retrieval/test-results-marginal";

// signal-incident
import "./signal-incident/get-incident";
import "./signal-incident/list-signals-for-incident";
import "./signal-incident/find-related-incidents";

// cross-boundary
import "./cross-boundary/field-vs-factory-gap";
import "./cross-boundary/operator-effect-analysis";
import "./cross-boundary/rework-timeline-by-section";

// semantic-vision-lessons
import "./semantic-vision-lessons/retrieve-lessons";
import "./semantic-vision-lessons/classify-defect-image";

// simulation
import "./simulation/simulate-impact";

// write-gated
import "./write-gated/create-initiative";
import "./write-gated/register-closure-predicate";
import "./write-gated/emit-lesson";
import "./write-gated/emit-impact-measurement";

// contributions
import "./contributions/central-quality";
import "./contributions/plant-quality";
import "./contributions/supplier-quality";

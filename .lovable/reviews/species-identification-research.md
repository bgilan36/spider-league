# Spider identification options

## Recommendation
Improve the existing fast vision pass with full diagnostic reference facts, geographic context as a soft prior, and conservative family-level identification. Keep one call for uncertain photos rather than reinstating the slower second opinion. No available evidence establishes that swapping general-purpose models alone improves spider accuracy.

## Alternatives researched
- **iNaturalist:** a specialized visual classifier plus a geographic model is compelling, but the full species model is private; do not depend on an undocumented endpoint. [Model availability](https://github.com/inaturalist/inatVisionAPI/) · [Geomodel](https://www.inaturalist.org/blog/84677-introducing-the-inaturalist-geomodel)
- **BioCLIP 2 / 2.5:** a promising biology-specific classifier trained on TreeOfLife-200M, suitable for a later labeled-photo benchmark. Production use needs a separately hosted inference service and measured spider-specific performance. [Project](https://github.com/Imageomics/bioclip-2/)
- **General vision model with reference grounding (selected):** already deployable here; improve inputs and candidate handling without extra infrastructure or additional routine AI checks.

## Accuracy problems in the current implementation
- The model receives truncated morphology but no reference range/habitat, despite having those facts locally.
- Unknown location is treated as the continental US.
- Family-level results are explicitly demoted in favor of close species guesses.
- Legacy keyword matching can convert malformed output into an apparently confident species.
- Regional words in names artificially increase confidence.
- Candidates are not sorted or deduplicated before uncertainty checks.

## Implementation
Use complete short diagnostic facts and range/habitat in the compact catalog; ask for visible evidence, ambiguity and image quality. Treat missing visual evidence and unresolved lookalikes as group-level identifications, retain species alternatives, and remove artificial confidence boosts. Migrate inference transport to the supported Gateway SDK while preserving existing model choices and the fast single-pass policy.

## Evaluation limits
Many spider species require microscopic genital morphology; a phone photo cannot always establish a species. [SpIDAI research](https://www.belspo.be/Belspo/fedra/proj.asp?COD=P4S%2F251%2FSpIDAI&l=en)
Regression tests can prove ranking and uncertainty behavior, not biological accuracy. A claim of higher measured accuracy requires a held-out, expert-labeled spider photo set.

## Verification
Deployed `spider-identify`; Deno contract checking passed, all 7 new identification regressions passed, and all 5 existing app tests passed. The deployed endpoint correctly rejects unsigned requests. Actual signed-in inference, latency and measured biological accuracy remain unverified because the backend uses external authentication and no expert-labeled evaluation set was available.
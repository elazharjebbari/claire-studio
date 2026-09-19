# 04b — Page copy (English, single source)

> Every user-facing string of the reviewer page comes from here. French is reserved for `/presentation`. Numbers in brackets are generated at build time from `RELEASE.json`; never type them by hand.

## Header

- Nav: **Try the classifier** · **Data** · **Key figures** · **Protocol** · **Platform** · **Français**

## Hero

- Kicker: `JURIX 2026 · companion page for reviewers`
- Title: **A Thematic Layer for CLAUDETTE**
- Subtitle: *Separating the cost of multi-label annotation from the effect of taxonomy granularity*
- Lead: `The CLAUDETTE / UNFAIR-ToS corpus records whether a sentence is unfair, never what the clause is about. This page gives reviewers everything the paper releases: the thematic layer with its individual votes, the frozen gold standard, the four LLM judges and their exact prompts, the frozen taxonomies, the codebook and the protocol — and a fine-tuned Legal-BERT you can run on your own text.`
- Buttons: `Try the classifier` · `Download the data` · `Open the annotation platform`
- Fingerprint line: `Dataset fingerprint {fingerprint16} · 50 contracts · 9,414 sentences · 3 trained annotators · 4 LLM judges`

## Try the classifier

- Section title: **Try the classifier**
- Intro: `Legal-BERT fine-tuned with the paper's recipe on the 33 design contracts (11-theme taxonomy, ±1 sentence of context, 8 epochs, seed 42). The 17 contracts offered below were never seen during training. Your text is processed once and not stored.`
- Tabs: `Paste text` · `Upload a .txt file` · `CLAUDETTE contract (held out)`
- Textarea placeholder: `Paste an English contract or terms of service (up to 60,000 characters).`
- Counter: `{chars} / 60,000 characters · about {sentences} sentences · {English ✓ | Please paste English text}`
- Upload help: `Plain text only (.txt, up to 200 KB). The file is read in your browser.`
- Contract picker label: `Choose one of the 17 held-out contracts` · item: `{name} · {n} sentences`
- Button: `Classify` · pending: `Classifying…` · error: `Try again`
- Status lines: `Waiting in queue (position {n})…` · `Loading the model…` · `Classifying {n} sentences…`
- Errors:
  - too long: `This text exceeds 60,000 characters. Please shorten it.`
  - empty: `Paste or upload some text first.`
  - not English: `The classifier was trained on English contracts; please provide English text.`
  - throttled: `You have reached the hourly limit for this demo. The data and figures below remain available.`
  - queue full: `Three requests are already waiting. Please try again in a minute.`
  - failed: `The classification could not be completed. Please try again.`
- Truncation notice: `Only the first 400 sentences were classified.`

## Result

- Title: `Result — {title}` (held-out contract: `Result — {name} (CLAUDETTE, held out)`)
- Summary (contract): `Accuracy against the gold standard {acc} · Cohen's κ {kappa} · {n} sentences · Judges: Fable {a}, Claude {b}, Mistral {c}, Codex {d}`
- Summary (text): `{n} sentences · {segments} thematic segments · median confidence {conf}`
- Column heads: `#` · `Sentence` · `Model` · `Gold` · `A1` `A2` `A3` · `Judges`
- Side rail: `Contents` · `Legend` · taxonomy switch `11 themes` / `20 themes`
- Filter: `Show disagreements only`
- Export: `Export JSON` · `Export CSV` · note for contracts: `Exports omit the sentence text (CLAUDETTE licence).`
- Legend note: `Colours follow the annotation workshop; the label is always shown.`

## What we release

- Section title: **What we release**
- Intro: `All files below are the ones every figure of the paper was computed from. Records are keyed by (document, index) and join directly onto the CLAUDETTE corpus, whose sentences we do not redistribute. Annotators appear as A1, A2 and A3.`
- Cards:
  1. **Individual votes** — `votes.jsonl · {n} records · one record per (document, sentence, annotator): primary theme and secondary themes.`
  2. **Gold standard and arbitration trail** — `gold.jsonl · {n} records · agreement class (strict / majority / divergence), cascade tier (auto_1click / auto / manual), engine proposal, decided themes, vote tally, confidence.`
  3. **LLM judges** — `judges.jsonl · {n} records · Claude Fable 5, Claude Opus 4.7, Mistral Medium 3.5, GPT-5.5 on the same sentences and vocabulary.`
  4. **Judge prompts** — `prompts/ · the exact instruction files and runbooks (protocol v9.2), with model, harness and dates per judge.`
  5. **Frozen taxonomies** — `taxonomies.json · T20 (annotated) and the T14 / T11 / T10 projections, design / held-out document partition, specification v1.`
  6. **Codebook** — `the 20 themes with their definitions, the segmentation and multi-label rules given to annotators.`
  7. **Protocol** — `independent annotation, isolated judges, three-tier resolution cascade, read-time projections, document-level bootstrap.`
  8. **Annotation platform** — `source on GitHub · running instance (sign in) · public projects.`
- Zip line: `Everything in one archive: thematic-layer-{fingerprint16}.zip · {size} · SHA-256 {sha16}`
- Preview toggle: `Preview the first records`

## Key figures

- Section title: **Key figures**
- Intro: `Generated from the released files; open “how computed” for the source of each number.`
- Rows (labels): `Krippendorff's α (MASI distance), three annotators` · `Nominal α on primary themes` · `Gain from consolidating 20 → 11 themes (α-MASI)` · `Human ceiling, κ (leave-one-annotator-out)` · `Legal-BERT fine-tuned, κ [95 % CI]` · `Best LLM judge (Claude Fable 5), κ` · `Served model: 33 design → 17 held-out contracts, macro-F1 / κ`
- Column heads: `Measure` · `20 themes` · `11 themes` · `How computed`

## Protocol (disclosure)

`All 50 English contracts of CLAUDETTE (9,414 sentences) were labelled independently by three trained annotators working from a written codebook, with one primary theme and zero or more secondary themes from a closed 20-theme vocabulary. Four large language models labelled the same sentences in isolated sessions and were kept out of the reference. The gold standard is resolved strictly between annotators by a three-tier cascade: strict agreement, majority of two, human arbitration for the remainder. Coarser taxonomies are deterministic projections applied at read time, so every comparison is paired by construction; confidence intervals come from bootstrap resampling over documents. The merges were designed on 33 contracts and validated on the 17 held out from that design.`

## Codebook (disclosure)

- Intro: `Twenty themes, one primary theme per sentence, secondary themes when a sentence genuinely does two things. A theme change starts a new clause.`
- English labels and definitions (T20):
  - META — Metadata, dates, addresses — headers, effective dates, contact details, document titles.
  - PREAMBLE_SCOPE — Preamble and scope — purpose of the agreement, scope, acceptance.
  - PRIVACY_DATA — Data and privacy — collection and use of data, reference to the privacy policy.
  - ELIGIBILITY_ACCOUNT — Eligibility and account — access conditions, age, account creation and security.
  - ACCEPTABLE_USE — Acceptable use — prohibited behaviour, abuse, usage restrictions.
  - USER_CONTENT — User content — content posted by the user and the rights granted over it.
  - LICENSE_IP — Licence and intellectual property — the provider's IP, licence to use the service or software.
  - MODIFICATION_OF_TERMS — Modification of terms — right to change the terms or the service.
  - TERMINATION — Termination — suspension or closure of the account or service.
  - WARRANTY_DISCLAIMER — Warranty disclaimer — service provided “as is”, no warranties.
  - LIMITATION_LIABILITY — Limitation of liability — caps and exclusions of liability and damages.
  - ARBITRATION_DISPUTES — Arbitration and disputes — dispute resolution, arbitration, class-action waiver.
  - GOVERNING_LAW — Governing law — applicable law and competent court.
  - THIRD_PARTY_SERVICES — Third-party services — links, integrations, third-party services.
  - FEES_PAYMENT — Fees and payment — prices, subscriptions, billing, refunds.
  - COMMUNICATIONS — Communications — notices, e-mails, administrative communications.
  - FEEDBACK — Feedback — user suggestions and the rights over them.
  - PROMOTIONS — Promotions — offers, contests, promo codes.
  - DMCA — DMCA and infringement — infringement notices, takedown procedure.
  - MISC_BOILERPLATE — Miscellaneous boilerplate — standard clauses (severability, entire agreement, assignment…).
- T11 labels: FRAMEWORK — Contractual framework and communications · CONTENT_IP — Content, IP and notices · ACCOUNT_USE — Account access and use · DISPUTES_LAW — Disputes, arbitration and governing law · PRIVACY_DATA — Data and privacy · MODIFICATION_OF_TERMS — Modification of terms · TERMINATION — Termination · LIMITATION_LIABILITY — Limitation of liability · WARRANTY_DISCLAIMER — Warranty disclaimer · THIRD_PARTY_SERVICES — Third-party services · FEES_PAYMENT — Fees and payment.

## The platform

- Section title: **The annotation platform**
- Text: `Pactiva is the platform the layer was produced, arbitrated and exported with. Public projects are open to everyone; the annotation workshop, the gold arbitration cockpit and the experiment lab require an account.`
- Links: `Public projects` · `Sign in` · `Source on GitHub`

## Footer

- Cite: `El Azhar Jebbari A., Lamirel J.-C., Boulaich F. Z., Ouali F. A Thematic Layer for CLAUDETTE: Separating the Cost of Multi-Label Annotation from the Effect of Taxonomy Granularity. JURIX 2026 (short paper, under review).`
- Companion: `A companion long paper, Executing the Grey List, builds on this layer.`
- Licence: `Annotation layer, prompts, taxonomies and code: released under an open licence upon publication. CLAUDETTE sentences remain under their own licence and are shown here for consultation only.`
- Contact: `{contact e-mail}` · `LORIA, Université de Lorraine, CNRS, Inria`

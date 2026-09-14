# JURIX 2026 Short Paper — Literature Map and Scientific Positioning

## 1. Working research objective

The broader research objective is **automatic detection of legal anomalies in online Terms of Service (ToS) contracts**.

In this project, legal anomaly detection is understood broadly as the identification of contractual content that may be:

- potentially unfair or abusive;
- legally non-compliant;
- inconsistent with applicable legal rules or contractual constraints;
- problematic only when interpreted in relation to surrounding provisions;
- difficult to detect reliably when the text is analysed sentence by sentence.

The **short JURIX 2026 paper does not need to solve the entire anomaly-detection problem**. Its role is to establish and evaluate a key intermediate representation:

> **logical / thematic segmentation of Terms of Service into semantically coherent legal units that are larger than individual sentences but substantially smaller than the full contract.**

The central hypothesis is that this intermediate granularity is better suited to downstream legal analysis than sentence-level segmentation.

---

## 2. Core scientific intuition

Most legal anomaly detection pipelines ultimately need to reason over a meaningful unit of legal content.

A sentence is convenient computationally, but it is not necessarily a complete legal unit.

A contractual rule may be expressed through:

- a main obligation in one sentence;
- an exception in the next sentence;
- a condition in a third sentence;
- a limitation or consequence in a fourth sentence.

Analysing these sentences independently can therefore fragment the legal meaning.

At the opposite extreme, analysing the entire ToS document at once creates other difficulties:

- excessively broad context;
- weaker localisation of anomalies;
- increased noise;
- reduced interpretability;
- difficulty associating a prediction with a precise contractual provision;
- higher computational cost for downstream models.

The proposed intermediate representation is therefore:

```text
Sentence
   ↓
Logical / thematic legal segment
   ↓
Clause / provision-level legal analysis
   ↓
Legal anomaly detection
   ↓
Structured representation / legal knowledge graph
   ↓
Rule-based or neuro-symbolic reasoning
```

A **logical segment** may contain one or several consecutive sentences that jointly express one coherent contractual topic, rule, obligation, right, exception, limitation, or legal mechanism.

---

## 3. Position of the short paper in the global project

### Global project

```text
Raw Terms of Service
        │
        ▼
Text extraction / normalization
        │
        ▼
Logical / thematic segmentation
        │
        ▼
Semantic classification of segments
        │
        ▼
Extraction of legal entities, relations and obligations
        │
        ▼
Structured legal representation / graph
        │
        ▼
Rules and reasoning
        │
        ▼
Detection of legal anomalies
```

### Scope of the JURIX short paper

The short paper should focus primarily on:

1. defining the segmentation task;
2. explaining why sentence-level granularity is potentially insufficient;
3. presenting the annotation methodology;
4. describing the use of LLM pre-annotation as annotation assistance;
5. building a human-validated gold dataset;
6. measuring inter-annotator agreement;
7. training/evaluating one or more segmentation or classification baselines;
8. releasing the annotation platform, dataset and/or code where possible.

The **downstream anomaly detector** should be presented as the motivating task and future / subsequent research stage.

This keeps the contribution narrow enough for a 5-page paper while making the scientific motivation much stronger.

---

# 4. Research problem

## 4.1 Problem statement

Existing work on automated ToS analysis has shown that NLP and machine-learning systems can identify potentially unfair or abusive clauses.

However, many existing systems operate on predefined clauses, sentences, or already segmented provisions.

This creates an upstream question:

> **What is the appropriate textual granularity for automated legal anomaly detection in Terms of Service?**

We hypothesize that a semantically coherent legal unit frequently spans multiple sentences.

Therefore, treating every sentence as an independent instance may:

- split conditions from consequences;
- separate rules from exceptions;
- disconnect definitions from their application;
- hide dependencies between neighbouring sentences;
- create false positives or false negatives in downstream anomaly detection.

---

# 5. Main hypothesis

## H1 — Intermediate-granularity hypothesis

**Logical/thematic legal segments provide a more appropriate unit of analysis for downstream ToS anomaly detection than isolated sentences.**

This hypothesis does not necessarily need to be fully proven in the short paper.

The paper can establish the first required empirical foundation:

> humans can consistently identify these segments, and computational models can reproduce this segmentation with useful accuracy.

A later paper can evaluate whether anomaly detection actually improves when performed over these segments.

---

# 6. Possible research questions for the short paper

## RQ1 — Annotation feasibility

**Can human annotators consistently identify logical/thematic legal segments in Terms of Service?**

Evaluation:

- pairwise agreement;
- boundary agreement;
- Cohen's κ where applicable;
- Fleiss' κ or Krippendorff's α for three annotators;
- disagreement analysis;
- adjudication statistics.

---

## RQ2 — LLM-assisted annotation

**Can an LLM provide useful pre-annotations for thematic segmentation while preserving a human-controlled gold-standard construction process?**

Possible evaluation:

- LLM boundaries vs final gold boundaries;
- precision / recall / F1;
- proportion of proposed segments accepted unchanged;
- proportion edited;
- proportion rejected;
- annotation time reduction, if measured.

Important methodological principle:

> LLM annotations should be treated as **pre-annotations**, not as ground truth.

Humans must remain responsible for the validated gold corpus.

---

## RQ3 — Automatic segmentation

**How accurately can computational models reproduce expert-validated thematic segmentation of ToS contracts?**

Possible baselines:

- sentence-by-sentence baseline;
- rule-based segmentation;
- embedding similarity between adjacent sentences;
- transformer classifier for boundary detection;
- legal-domain transformer;
- LLM prompting baseline.

---

## Optional RQ4 — Granularity

If enough experiments can be completed:

**Do thematic segments preserve more legally relevant context than sentence-level units?**

This could be measured indirectly through:

- downstream clause classification;
- anomaly category classification;
- information extraction performance.

However, this should remain optional for the 5-page paper.

---

# 7. Annotation methodology

## 7.1 Proposed workflow

```text
ToS documents
     │
     ▼
Sentence segmentation
     │
     ▼
LLM-generated thematic segmentation (pre-annotation)
     │
     ▼
Independent human review / correction
     │
     ├── Annotator 1
     ├── Annotator 2
     └── Annotator 3
     │
     ▼
Agreement measurement
     │
     ▼
Disagreement resolution / adjudication
     │
     ▼
Gold thematic segmentation
```

---

## 7.2 Role of the LLM

The LLM may be used to reduce annotation effort by proposing initial segment boundaries.

This use is supported by prior research showing that LLMs can perform semantic annotation of legal text and can participate in human–LLM annotation workflows.

However, the literature also warns that LLM performance can vary substantially on specialised legal tasks.

Therefore the methodological position should be:

> **LLM-assisted annotation, not LLM-defined ground truth.**

---

## 7.3 Gold-standard construction

For three annotators, the recommended workflow is:

1. independent annotation or independent correction of pre-annotations;
2. computation of agreement;
3. preservation of all individual annotation layers;
4. explicit disagreement identification;
5. adjudication / reconciliation session;
6. production of a single final gold layer.

A simple majority vote can be useful as an intermediate signal, but should not automatically replace adjudication for semantically important disagreements.

The final corpus should ideally preserve:

- raw text;
- LLM pre-annotation;
- annotator A;
- annotator B;
- annotator C;
- adjudicated gold segmentation.

This makes the resource unusually useful for future research on annotation disagreement and human–AI collaboration.

---

# 8. Annotation platform as a scientific artifact

The annotation platform is not merely an implementation detail.

If it allows researchers to:

- view ToS documents;
- inspect proposed segment boundaries;
- add / delete / move boundaries;
- assign semantic labels;
- compare annotations;
- revise annotations;
- visualise the segmented contract;
- export annotations;
- download datasets;

then it can be presented as part of the reproducibility contribution.

A strong reproducibility package could include:

```text
Dataset
Annotation guidelines
Annotation platform
Source code
Model baselines
Evaluation scripts
Gold annotations
Pre-annotation prompts
```

This can substantially increase the impact of a short paper.

---

# 9. State of the art

## 9.1 ToS unfair-clause detection

### [1] CLAUDETTE

**Lippi, M., Palka, P., Contissa, G., Lagioia, F., Micklitz, H., Sartor, G., Torroni, P.**

**CLAUDETTE: an automated detector of potentially unfair clauses in online terms of service.**

Artificial Intelligence and Law, 27, 117–139.

DOI: `10.1007/s10506-019-09243-2`

Consensus:
https://consensus.app/papers/claudette-an-automated-detector-of-potentially-unfair-lippi-palka/903b06b7e2e955ce842b0816e00a85b2/?utm_source=chatgpt

### Relevance

CLAUDETTE is one of the foundational systems for automatic detection of potentially unfair clauses in online Terms of Service.

It establishes the feasibility and value of automated ToS analysis.

### Relation to our paper

Our work is upstream of the final unfair-clause classifier.

Instead of assuming that the appropriate contractual unit is already available, we investigate how the document should first be decomposed into coherent legal units.

---

## 9.2 Multilingual unfair-clause detection

### [2] Galassi et al.

**Galassi, A., Lagioia, F., Jabłonowska, A., Lippi, M.**

**Unfair clause detection in terms of service across multiple languages.**

Artificial Intelligence and Law, 33, 641–689, 2024.

DOI: `10.1007/s10506-024-09398-7`

Consensus:
https://consensus.app/papers/unfair-clause-detection-in-terms-of-service-across-galassi-lagioia/a2e4abab1a4b5da4b61664c43d99e93f/?utm_source=chatgpt

### Relevance

The work demonstrates that automated unfair-clause detection can be transferred across languages without necessarily recreating a full annotated corpus for every language.

### Relation to our work

The study reinforces the importance of reusable structured representations of ToS.

Our segmentation layer could potentially facilitate future multilingual transfer because it creates semantically coherent units before anomaly classification.

---

## 9.3 Recent ToS abusive-clause classification

### [3] Löffler et al.

**Löffler, C., Martínez Freile, A., Rey Pizarro, T.**

**Predicting potentially abusive clauses in Chilean terms of services with natural language processing.**

Artificial Intelligence and Law, 2025.

DOI: `10.1007/s10506-025-09462-w`

Consensus:
https://consensus.app/papers/predicting-potentially-abusive-clauses-in-chilean-terms-löffler-freile/f0bc9092d2425ca2be6c2d661af24eb8/?utm_source=chatgpt

### Key results

The paper introduces:

- 50 ToS;
- four main annotation categories;
- 20 classes;
- transformer-based detection and classification.

Reported detection performance reaches approximately:

- Macro-F1: 79–89%;
- Micro-F1: up to 96%.

### Relation to our work

This paper confirms that clause-level legal anomaly / abuse classification is a viable downstream target.

Our contribution asks a prior question:

> how should the text be segmented before such a classifier receives its input?

---

## 9.4 LLMs versus specialised models for unfair ToS detection

### [4] Panarelli et al.

**Panarelli, M., Galassi, A., Lagioia, F., Liepiņa, R., Lippi, M., Pałka, P., Sartor, G.**

**Is It Worth Using LLMs for Unfair Clause Detection in Terms of Service?**

Proceedings of the Twentieth International Conference on Artificial Intelligence and Law, 2025.

DOI: `10.1145/3769126.3769218`

Consensus:
https://consensus.app/papers/is-it-worth-using-llms-for-unfair-clause-detection-in-terms-panarelli-galassi/65f5194e92e25d95be6a64109dabbc47/?utm_source=chatgpt

### Relevance

This work directly compares prompting strategies for LLMs with traditional fine-tuned BERT-based models for unfair-clause detection.

The results indicate that specialised fine-tuned models remain highly competitive and may outperform generic LLM prompting for this domain-specific task.

### Relation to our project

This strongly supports a hybrid research strategy:

```text
LLM
   → annotation assistance / pre-annotation

Human experts
   → gold data

Task-specific model
   → scalable production inference
```

The LLM is therefore not necessarily the final anomaly detector.

---

# 10. LLM-assisted legal annotation literature

## 10.1 Savelka & Ashley

### [5]

**Savelka, J., Ashley, K. D.**

**The unreasonable effectiveness of large language models in zero-shot semantic annotation of legal texts.**

Frontiers in Artificial Intelligence, 6, 2023.

DOI: `10.3389/frai.2023.1279794`

Consensus:
https://consensus.app/papers/the-unreasonable-effectiveness-of-large-language-models-savelka-ashley/614f796c2b4555afafcc91159d96d76c/?utm_source=chatgpt

### Relevance

This is one of the most important references for our annotation methodology.

The authors evaluate GPT-family models on semantic annotation tasks involving:

- judicial opinions;
- contractual clauses;
- statutory provisions.

They show that modern LLMs can provide useful zero-shot semantic annotations.

### Relation to our work

This paper provides methodological support for using an LLM as a **pre-annotation mechanism** before expert validation.

---

## 10.2 CoAnnotating

### [6]

**Li, M., Shi, T., Ziems, C., Kan, M.-Y., Chen, N. F., Liu, Z., Yang, D.**

**CoAnnotating: Uncertainty-Guided Work Allocation between Human and Large Language Models for Data Annotation.**

EMNLP, 2023.

DOI: `10.18653/v1/2023.emnlp-main.92`

Consensus:
https://consensus.app/papers/coannotating-uncertaintyguided-work-allocation-between-li-shi/40c87fbce0425a4ca05e4d81d274cd5b/?utm_source=chatgpt

### Relevance

CoAnnotating explicitly studies collaboration between humans and LLMs for annotation.

The framework uses model uncertainty to decide how annotation work should be distributed.

The reported experiments show improvements of up to 21% over random allocation.

### Relation to our work

Our annotation process fits naturally into this broader paradigm of **human–LLM collaborative annotation**.

---

# 11. Warnings from the literature

## 11.1 Lawma / specialised legal annotation

### [7]

**Dominguez-Olmedo, R. et al.**

**Lawma: The Power of Specialization for Legal Tasks.**

2024.

DOI: `10.48550/arxiv.2407.16615`

Consensus:
https://consensus.app/papers/lawma-the-power-of-specialization-for-legal-tasks-dominguez-olmedo-nanda/3d108c66ec4354d398c7ae60114872d8/?utm_source=chatgpt

### Main lesson

General-purpose commercial LLMs achieve non-trivial but variable performance on legal annotation.

Fine-tuned smaller models can outperform general-purpose systems once several hundred or thousand labelled examples are available.

### Consequence for our methodology

We should avoid framing the LLM as an oracle.

Instead:

```text
LLM pre-annotation
        +
human expertise
        ↓
gold data
        ↓
specialised supervised model
```

---

## 11.2 Legal reasoning at the edge of human agreement

### [8]

**Thalken, R., Stiglitz, E. H., Mimno, D., Wilkens, M.**

**Modeling Legal Reasoning: LM Annotation at the Edge of Human Agreement.**

2023.

DOI: `10.48550/arxiv.2310.18440`

Consensus:
https://consensus.app/papers/modeling-legal-reasoning-lm-annotation-at-the-edge-of-human-thalken-stiglitz/371565711ad6584cad126c9ccb60984e/?utm_source=chatgpt

### Main lesson

Generative models can perform poorly when legal annotation requires complex expert judgement.

The work highlights the continued importance of domain experts and human-annotated datasets.

### Relation to our work

This is precisely why our LLM output should remain a **suggestion layer** rather than the gold standard.

---

# 12. Human–LLM legal corpus construction

## [9] LAMUS

**Wang, S., Pobbathi, L., Chen, H.**

**LAMUS: A Large-Scale Corpus for Legal Argument Mining from U.S. Caselaw using LLMs.**

2026.

DOI: `10.47852/bonviewjcllt62029649`

Consensus:
https://consensus.app/papers/lamus-a-largescale-corpus-for-legal-argument-mining-from-us-wang-pobbathi/f958675d969a5edd926b9775e14b5dd3/?utm_source=chatgpt

### Relevance

LAMUS is methodologically close to our intended workflow:

```text
LLM automatic annotation
        ↓
targeted human refinement
        ↓
validated corpus
```

Human verification reportedly reaches Cohen's κ = 0.85.

### Relation to our work

It provides contemporary evidence that LLM-assisted legal corpus creation with human validation is scientifically defensible.

---

# 13. From legal text to structured graphs

The final project aims to go beyond classification and detect legal anomalies through structured reasoning.

This makes legal knowledge-graph research relevant even if the graph itself is outside the first short paper.

## [10] GRAPH-GRPO-LEX

**Dechtiar, M., Katz, D. M., Sundaresan, M., Jaume, S., Wang, H.**

**GRAPH-GRPO-LEX: Contract Graph Modeling and Reinforcement Learning With Group Relative Policy Optimization.**

IEEE International Conference on Data Mining Workshops, 2025.

DOI: `10.1109/icdmw69685.2025.00092`

Consensus:
https://consensus.app/papers/graphgrpolex-contract-graph-modeling-and-reinforcement-dechtiar-katz/3ff39b132c7454ff8345a18a5b17db11/?utm_source=chatgpt

### Relevance

The work converts contracts into structured semantic graphs.

It models:

- entities;
- relations;
- clauses;
- direct dependencies;
- implicit dependencies.

### Relation to our project

Our thematic segmentation can provide cleaner units from which graph entities and relations may later be extracted.

The global architecture could therefore become:

```text
ToS
 ↓
Thematic legal segments
 ↓
Semantic labels
 ↓
Entities / obligations / rights / exceptions
 ↓
Legal knowledge graph
 ↓
Legal rules
 ↓
Anomaly detection
```

---

# 14. Broader contract classification literature

## [11] Singh et al.

**Singh, A., Joshi, A., Jiang, J., Paik, H.-Y.**

**A survey of classification tasks and approaches for legal contracts.**

Artificial Intelligence Review, 58, 2025.

DOI: `10.1007/s10462-025-11359-8`

Consensus:
https://consensus.app/papers/a-survey-of-classification-tasks-and-approaches-for-legal-singh-joshi/b5e0e25237095ba89d9c8d4fb1ec3ee5/?utm_source=chatgpt

### Relevance

The survey identifies:

- seven contract-classification task families;
- fourteen English-language contract datasets;
- traditional ML approaches;
- deep learning;
- transformer-based methods.

### Relation to our paper

This paper can provide the broader Legal NLP background while our related-work section focuses on the narrower ToS segmentation + anomaly-detection problem.

---

# 15. Scientific gap

The literature already establishes that:

1. unfair or abusive ToS clauses can be automatically detected;
2. transformer models can classify legal clauses;
3. LLMs can semantically annotate legal text;
4. human–LLM collaborative annotation is viable;
5. legal contracts can be converted into structured graphs.

However, the **representation level preceding anomaly detection** is comparatively under-emphasised.

A common assumption is that an appropriate clause or sentence unit is already available.

Our work targets this upstream issue.

## Proposed gap statement

> Existing approaches to automated analysis of Terms of Service typically perform classification or unfairness detection over sentences, clauses, or otherwise pre-segmented textual units. Yet contractual meaning frequently spans several consecutive sentences, where obligations, conditions, exceptions and consequences jointly form a coherent legal provision. We therefore investigate thematic legal segmentation as an intermediate representation between sentence-level analysis and whole-document reasoning.

This is potentially the central research gap of the short paper.

---

# 16. What is novel — and what is not

## Not novel by itself

- using BERT for legal classification;
- using an LLM for annotation;
- detecting unfair ToS clauses;
- using humans to validate annotations;
- building a legal knowledge graph.

All of these already exist.

## Potentially novel combination

The contribution can instead lie in:

> **defining, annotating and evaluating a thematic segmentation layer specifically designed as an intermediate representation for downstream legal anomaly detection in Terms of Service.**

The novelty becomes stronger if the work provides:

- a precise segmentation definition;
- expert annotation guidelines;
- multi-annotator gold data;
- LLM pre-annotation analysis;
- quantitative agreement measurements;
- automatic segmentation baselines;
- public annotation tooling;
- public dataset and code.

---

# 17. Possible formal definition of a thematic legal segment

A working definition for the annotation guideline:

> **A thematic legal segment is a maximal contiguous sequence of one or more sentences that jointly expresses a coherent contractual topic, rule, right, obligation, permission, prohibition, condition, exception, limitation, consequence, or legal mechanism, such that splitting the sequence would materially reduce the legal or semantic context required to interpret the provision.**

Important properties:

### Contiguous
Segments contain consecutive textual units.

### One or more sentences
A segment may consist of a single sentence when the legal meaning is self-contained.

### Semantically coherent
The sentences jointly address the same contractual mechanism or legal topic.

### Maximal
A segment should not be unnecessarily fragmented.

### Legal-context preserving
A boundary should not separate information necessary for interpreting a provision.

---

# 18. Examples of why sentence-level analysis may fail

## Example A — rule + exception

```text
The provider may terminate your account at any time.
However, termination without notice is permitted only where fraud is suspected.
```

Sentence-level treatment creates two independent units.

Legal interpretation requires the second sentence to qualify the first.

Preferred representation:

```text
[SEGMENT]
The provider may terminate your account at any time.
However, termination without notice is permitted only where fraud is suspected.
[/SEGMENT]
```

---

## Example B — right + consequence

```text
Users may request deletion of their account.
Following deletion, certain transaction records may be retained for five years where required by law.
```

The second sentence materially qualifies the scope of the first.

---

## Example C — obligation + condition + sanction

```text
Users must provide accurate registration information.
This obligation applies throughout the duration of the service.
Failure to maintain accurate information may result in account suspension.
```

The legal mechanism spans three sentences.

---

# 19. Evaluation framework

## 19.1 Human agreement

Because segmentation is fundamentally a boundary-identification task, ordinary classification agreement alone may be insufficient.

Possible measures:

- boundary precision;
- boundary recall;
- boundary F1;
- WindowDiff;
- Pk;
- segment overlap;
- Intersection over Union;
- Krippendorff's α on boundary decisions.

For semantic labels:

- Cohen's κ;
- Fleiss' κ;
- Krippendorff's α.

---

## 19.2 LLM pre-annotation quality

Compare LLM boundaries with adjudicated gold.

Possible metrics:

```text
Boundary Precision
Boundary Recall
Boundary F1
WindowDiff
Pk
Exact segment match
Mean overlap / IoU
```

Also useful:

```text
% accepted without modification
% boundary moved
% segment split
% segments merged
% completely rejected proposals
```

These editing statistics could make the annotation-methodology contribution particularly interesting.

---

## 19.3 Automatic segmentation baselines

Minimum useful baselines:

### Baseline 1
Every sentence = one segment.

### Baseline 2
Paragraph boundaries = segments.

### Baseline 3
Embedding similarity threshold between adjacent sentences.

### Baseline 4
Transformer binary boundary classifier.

Input:

```text
sentence_i + sentence_i+1
```

Output:

```text
CONTINUE
BOUNDARY
```

### Baseline 5
Legal-domain transformer.

### Baseline 6
LLM zero-shot / few-shot segmentation.

This allows a meaningful comparison between simple structural heuristics, supervised NLP models and LLMs.

---

# 20. Critical methodological risks

## 20.1 Pre-annotation anchoring bias

Showing LLM boundaries to human annotators can influence their judgement.

Possible mitigations:

- measure a subset annotated without LLM assistance;
- have at least one independent annotation phase;
- document the effect explicitly;
- distinguish correction time from fully independent annotation.

---

## 20.2 Circular evaluation

Do not evaluate the LLM only against a gold standard heavily derived from its own suggestions without independent validation.

The adjudicated gold standard must reflect human expert judgement.

---

## 20.3 Ambiguous segmentation

Some boundaries will be inherently debatable.

This is not necessarily a weakness.

Disagreement analysis can itself reveal:

- underspecified guidelines;
- overlapping legal topics;
- nested provisions;
- legitimate multiple granularities.

These cases should be analysed rather than silently removed.

---

## 20.4 Nested structure

ToS may naturally contain hierarchical structure:

```text
Section
 └── Topic
      └── Provision
           └── Sentence
```

The first paper may deliberately restrict the task to a single segmentation layer.

This should be stated clearly.

---

# 21. Suggested scientific contribution statement

A possible contribution framing:

> We introduce a human-validated thematic segmentation framework for online Terms of Service designed as an intermediate representation for downstream legal anomaly detection. Unlike sentence-level processing, the proposed representation groups consecutive sentences that jointly express a coherent contractual mechanism. We provide annotation guidelines, investigate LLM-assisted pre-annotation, quantify inter-annotator agreement, and evaluate automatic segmentation baselines. The resulting corpus and annotation tooling are intended to support subsequent research on unfair-clause detection, structured contract modelling and legal anomaly reasoning.

---

# 22. Suggested title directions

### Conservative

**Thematic Segmentation of Terms of Service for Legal Contract Analysis**

### More explicit

**Beyond Sentences: Thematic Segmentation of Terms of Service for Legal Anomaly Detection**

### Dataset / annotation angle

**Building a Human-Validated Thematic Segmentation Corpus for Terms of Service**

### Human–LLM angle

**Human–LLM Collaborative Segmentation of Terms of Service for Legal Analysis**

### Strong JURIX-style framing

**Towards Legal Anomaly Detection in Terms of Service through Thematic Contract Segmentation**

The last formulation is particularly useful if anomaly detection itself is not yet evaluated in the short paper.

---

# 23. Suggested 5-page JURIX structure

Because references do not count toward the five-page short-paper limit, the scientific body can be organised approximately as follows.

## Page 1

### 1. Introduction

- problem of ToS complexity;
- legal anomaly detection motivation;
- limitation of sentence-level analysis;
- hypothesis of intermediate thematic granularity;
- contributions.

---

## Page 2

### 2. Related Work

Three compact blocks:

1. unfair-clause detection in ToS;
2. LLM-assisted legal annotation;
3. contract structuring / segmentation.

End with the research gap.

### 3. Task Definition

- thematic segment definition;
- boundary rules;
- examples.

---

## Page 3

### 4. Dataset and Annotation Methodology

- ToS collection;
- sentence preprocessing;
- LLM pre-annotation;
- three annotators;
- annotation platform;
- adjudication;
- gold construction.

Include one pipeline figure.

---

## Page 4

### 5. Experiments

- agreement metrics;
- pre-annotation evaluation;
- segmentation baselines;
- implementation details.

### 6. Results

One dense table.

---

## Page 5

### 7. Discussion

- what disagreements reveal;
- LLM usefulness;
- granularity implications;
- threats to validity.

### 8. Conclusion

Connect segmentation directly to future anomaly detection and legal graph reasoning.

---

# 24. Recommended central figure

A single figure could communicate almost the entire contribution:

```text
┌─────────────────┐
│ Raw ToS Contract │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Sentence boundaries  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ LLM pre-segmentation │
└────────┬────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Human annotation / revision │
│ A1 · A2 · A3                │
└────────┬────────────────────┘
         │
         ▼
┌──────────────────┐
│ Adjudicated Gold │
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│ Segmentation Model    │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────────┐
│ Thematic Legal Segments  │
└────────┬─────────────────┘
         │
         ▼
╔══════════════════════════╗
║ Future downstream stage ║
║ Legal anomaly detection ║
║ + knowledge graph       ║
╚══════════════════════════╝
```

---

# 25. Literature-to-contribution matrix

| Work | ToS | Unfair / anomaly detection | Human annotation | LLM annotation | Segmentation focus | Knowledge graph | Relevance |
|---|---:|---:|---:|---:|---:|---:|---|
| CLAUDETTE | ✓ | ✓ | ✓ | ✗ | Clause-level input | ✗ | Foundational downstream task |
| Galassi et al. 2024 | ✓ | ✓ | ✓ | ✗ | Clause-level | ✗ | Multilingual ToS detection |
| Löffler et al. 2025 | ✓ | ✓ | ✓ | limited | Clause-level | ✗ | Modern abusive-clause dataset |
| Panarelli et al. 2025 | ✓ | ✓ | ✓ | ✓ | Clause-level | ✗ | LLM vs specialised models |
| Savelka & Ashley 2023 | partial | annotation | ✓ | ✓ | semantic units | ✗ | Legal LLM pre-annotation |
| CoAnnotating 2023 | ✗ | ✗ | ✓ | ✓ | generic text | ✗ | Human–LLM workflow |
| Lawma | legal | classification | ✓ | ✓ | task dependent | ✗ | Limits of generic LLMs |
| Thalken et al. | legal | ✗ | ✓ | ✓ | task dependent | ✗ | Expert annotation importance |
| LAMUS 2026 | legal | ✗ | ✓ | ✓ | sentence-level argument units | ✗ | Corpus construction methodology |
| GRAPH-GRPO-LEX | contracts | downstream analysis | limited | ✓ | clause/relations | ✓ | Future graph stage |
| **Our work** | **✓** | **motivating downstream task** | **✓** | **✓ pre-annotation** | **✓ thematic multi-sentence units** | **future stage** | **Intermediate granularity for anomaly detection** |

This table should be expanded as the literature review progresses.

---

# 26. The strongest positioning sentence

The core idea of the paper can be reduced to one sentence:

> **Before asking whether a contractual provision is legally anomalous, we first ask what textual span constitutes the provision that should be analysed.**

That is the conceptual hinge of the short paper.

---

# 27. Next literature-review targets

The next research pass should deliberately search for work on:

```text
legal document segmentation
contract segmentation
clause boundary detection
discourse segmentation legal documents
topic segmentation contracts
semantic segmentation legal text
multi-sentence legal classification
context-aware unfair clause detection
cross-sentence legal reasoning
legal discourse units
Terms of Service clause segmentation
contract provision extraction
```

The goal is to verify whether the exact intermediate-granularity hypothesis has already been studied.

If little prior work exists, that absence becomes part of the research gap.

---

# 28. Current strategic recommendation

For the JURIX short paper, avoid presenting the work as:

> “We use an LLM to annotate Terms of Service.”

That contribution would be too weak by itself.

Instead frame it as:

> **We study thematic legal segmentation as an intermediate representation for legal anomaly detection in Terms of Service, construct a human-validated gold corpus using an LLM-assisted annotation workflow, and evaluate whether this segmentation can be reproduced automatically.**

This framing connects:

- the legal motivation;
- the annotation methodology;
- the dataset;
- the LLM;
- the segmentation model;
- the annotation platform;
- the future anomaly detector;

without requiring the 5-page paper to solve every downstream stage.

---

# 29. References identified so far

1. Lippi, M., Palka, P., Contissa, G., Lagioia, F., Micklitz, H., Sartor, G., Torroni, P. **CLAUDETTE: an automated detector of potentially unfair clauses in online terms of service.** *Artificial Intelligence and Law*, 27, 117–139. DOI: 10.1007/s10506-019-09243-2.

2. Galassi, A., Lagioia, F., Jabłonowska, A., Lippi, M. **Unfair clause detection in terms of service across multiple languages.** *Artificial Intelligence and Law*, 33, 641–689, 2024. DOI: 10.1007/s10506-024-09398-7.

3. Löffler, C., Martínez Freile, A., Rey Pizarro, T. **Predicting potentially abusive clauses in Chilean terms of services with natural language processing.** *Artificial Intelligence and Law*, 2025. DOI: 10.1007/s10506-025-09462-w.

4. Panarelli, M., Galassi, A., Lagioia, F., Liepiņa, R., Lippi, M., Pałka, P., Sartor, G. **Is It Worth Using LLMs for Unfair Clause Detection in Terms of Service?** *ICAIL 2025*. DOI: 10.1145/3769126.3769218.

5. Savelka, J., Ashley, K. D. **The unreasonable effectiveness of large language models in zero-shot semantic annotation of legal texts.** *Frontiers in Artificial Intelligence*, 6, 2023. DOI: 10.3389/frai.2023.1279794.

6. Li, M., Shi, T., Ziems, C., Kan, M.-Y., Chen, N. F., Liu, Z., Yang, D. **CoAnnotating: Uncertainty-Guided Work Allocation between Human and Large Language Models for Data Annotation.** *EMNLP 2023*. DOI: 10.18653/v1/2023.emnlp-main.92.

7. Dominguez-Olmedo, R. et al. **Lawma: The Power of Specialization for Legal Tasks.** 2024. DOI: 10.48550/arxiv.2407.16615.

8. Thalken, R., Stiglitz, E. H., Mimno, D., Wilkens, M. **Modeling Legal Reasoning: LM Annotation at the Edge of Human Agreement.** 2023. DOI: 10.48550/arxiv.2310.18440.

9. Wang, S., Pobbathi, L., Chen, H. **LAMUS: A Large-Scale Corpus for Legal Argument Mining from U.S. Caselaw using LLMs.** 2026. DOI: 10.47852/bonviewjcllt62029649.

10. Dechtiar, M., Katz, D. M., Sundaresan, M., Jaume, S., Wang, H. **GRAPH-GRPO-LEX: Contract Graph Modeling and Reinforcement Learning With Group Relative Policy Optimization.** *IEEE ICDMW 2025*. DOI: 10.1109/icdmw69685.2025.00092.

11. Singh, A., Joshi, A., Jiang, J., Paik, H.-Y. **A survey of classification tasks and approaches for legal contracts.** *Artificial Intelligence Review*, 58, 2025. DOI: 10.1007/s10462-025-11359-8.

---

# 30. Working one-paragraph summary

This project investigates automatic legal anomaly detection in online Terms of Service. Rather than analysing contracts directly at sentence level, we hypothesise that many legally meaningful provisions span multiple consecutive sentences and therefore require an intermediate thematic segmentation layer. The JURIX short paper focuses on the construction and evaluation of this representation: Terms of Service are first sentence-segmented, an LLM proposes thematic boundaries as pre-annotations, multiple human annotators independently validate or revise them, disagreements are adjudicated to construct a gold corpus, and computational baselines are evaluated on the resulting segmentation task. The thematic units are intended to serve as the input granularity for subsequent unfair-clause detection, legal information extraction, knowledge-graph construction and rule-based anomaly reasoning.


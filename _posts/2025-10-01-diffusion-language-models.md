---
layout: distill
title: "Discrete Diffusion: A New Frontier For Language Modeling"
description: "We introduce diffusion language models and explain their main advantages over standard autoregerssive models using existing large diffusion models as examples. We also highlight diffusion for language as an emerging research direction in generative AI. Adapted from an invited talk at the ICML 2025 Workshop on Long-Context Foundation Models."
date: 2025-10-01
featured: true

authors:
  - name: Volodymyr Kuleshov
    url: "https://www.cs.cornell.edu/~kuleshov/"
    affiliations:
      name: Cornell University
      url: "https://www.cs.cornell.edu/"
  - name: Marianne Arriola
    url: "http://m-arriola.com/"
    affiliations:
      name: Cornell University
      url: "https://www.cs.cornell.edu/"
  - name: Yair Schiff
    url: "https://yair-schiff.github.io/"
    affiliations:
      name: Cornell University
      url: "https://www.cs.cornell.edu/"
  - name: Guanghan Wang
    url: "https://guanghanwang.github.io/"
    affiliations:
      name: Cornell University
      url: "https://www.cs.cornell.edu/"

bibliography: dllm-blog.bib

toc:
  - name: "Introduction: From Autoregression to Diffusion"
  - name: "Simple Masked Diffusion Language Models"
    subsections:
      - name: "Training: Learning to Denoise"
      - name: "Sampling: Iterative Text Generation"
  - name: "Key Advantages of Diffusion Language Models"
    subsections:
      - name: "Parallel Generation and Inference Efficiency"
      - name: "Retaining Variable-Length Generation and KV Caching"
      - name: "Iterative Refinement and Built-in Error Correction"
      - name: "Inference-Time Scaling and Flexible Computation"
      - name: "Enhanced Controllability and Guided Generation"
      - name: "Unified Framework for Multimodality"
  - name: "The Rise of Large Diffusion Language Models"
  - name: "Conclusion: A New Paradigm"
---

<h2 id="introduction-from-autoregression-to-diffusion">Introduction: From Autoregression to Diffusion</h2>

<p>
  Today, language modeling is dominated by autoregressive (AR)
  models, such as GPT and its many descendants. These models generate text left to right, one token at a time.
  While effective, this approach cannot easily parallelize generation and cannot correct previous mistakes, which compound as sampling continues.
</p>

<p>
  Diffusion models, originally developed for images, offer a fundamentally
  different approach. Instead of sequentially building up a sentence
  token-by-token, diffusion models learn to iteratively denoise a masked or
  corrupted version of the target text, refining their output over several
  steps. This enables parallel generation, built-in error correction, and global
  iterative refinement over the text as it is produced.
</p>

<p>
  This blog post introduces masked diffusion language
  models, the popular diffusion-based alternative to traditional AR models. We explain how these
  models work, highlight their unique advantages — such as parallel generation,iterative refinement, and better controllability —
  and finally describe several ongoing efforts in training large-scale diffusion
  LLMs.
</p>

<figure>
  <img src="{{ '/assets/img/diffusion-intro-comparison.png' | relative_url }}" alt="Autoregressive vs. diffusion generation compared on images" />
  <figcaption>Two ways to generate an image: an autoregressive model fills in pixels one at a time in a fixed raster-scan order (left), while a diffusion model starts from noise and denoises the whole image in parallel over a few steps (right). This post carries the same contrast over to text. Slide credit: Stefano Ermon.</figcaption>
</figure>

<h2 id="simple-masked-diffusion-language-models">Simple Masked Diffusion Language Models</h2>

<p>
  Most readers may be familiar with the standard autoregressive (AR) approach to
  language modeling: text is generated token-by-token, each new token
  conditioned only on the sequence generated so far. In contrast, masked
  diffusion language models (MDLMs) approach generation as an iterative
  denoising process that begins with a fully masked sequence and reveals tokens
  step-by-step
  <d-cite key="sahoo2024simple,shi2024simplified,ou2024your"></d-cite>. At each
  iteration, a transformer-based model predicts missing tokens, using
  information from both the left and right context.
</p>

<p>
  Training these models is straightforward: we use a BERT-style objective, but
  with a randomized masking rate that varies throughout training. Unlike
  traditional BERT, which is only used for representation learning, this
  approach admits principled generative sampling algorithms. In effect, we get a
  <em>generative BERT</em> that can both encode and generate text.
</p>

<figure>
  <img src="{{ '/assets/img/masked-diffusion-forward-reverse.png' | relative_url }}" alt="Forward and reverse processes side by side" />
  <figcaption>The forward (masking) and reverse (unmasking) processes: a datapoint $x$ is progressively masked into $z_t$, and an unmasking model $x_\theta$ learns to map back from $z_t$ to $x$. Slide credit: Sasha Rush.</figcaption>
</figure>

<h3 id="training-learning-to-denoise">Training: Learning to Denoise</h3>

<p>
  At the core of masked diffusion language models is the <strong>forward
  masking process</strong>, which progressively adds noise to text. Starting
  from a complete text sequence, we progressively mask (hide) random subsets of
  tokens according to a noise schedule — at each time step, the sequence becomes
  more corrupted. The level of corruption at each step is controlled by a
  masking probability, which can be uniform or follow a predefined schedule. By
  the end of this forward process, we have a fully masked sequence (all tokens
  hidden).
</p>

<figure>
  <img src="{{ '/assets/img/masked-diffusion-forward.png' | relative_url }}" alt="Forward masking process for masked diffusion language models" />
  <figcaption>The forward process masks each token of $x$ independently with probability $1-\alpha_t$: as the signal level $\alpha_t$ decays from 1 to 0, the partially-masked datapoint $z_t$ decays into a fully masked sequence. Slide credit: Sasha Rush.</figcaption>
</figure>

<aside>
  <p>Standard BERT masks a fixed ~15% of tokens at every training step. Masked diffusion models instead sample a fresh masking rate — anywhere from nearly 0% to 100% — at every step, so the model learns to denoise sequences at every noise level, not just one.</p>
</aside>

<p>
  The <strong>reverse process</strong> is the generative procedure: starting
  from this fully masked sequence, the model unmasks tokens in a sequence of
  iterative steps, each time filling in some of the blanks using its current
  best predictions. Each denoising step leverages the transformer's ability to
  reason over both observed and masked positions, making use of the entire
  available context.
</p>

<figure>
  <img src="{{ '/assets/img/masked-diffusion-reverse.png' | relative_url }}" alt="Reverse denoising process for masked diffusion language models" />
  <figcaption>The reverse (unmasking) process moves from a noisier $z_t$ to a less-noisy $z_s$ by combining the model's denoising predictions $p(z_s \mid z_t, x_\theta)$ with the unmasking posterior $q(z_s \mid z_t, x)$. Slide credit: Sasha Rush.</figcaption>
</figure>

<h3 id="sampling-iterative-text-generation">Sampling: Iterative Text Generation</h3>

<p>
  Once trained, masked diffusion language models generate text by iteratively
  denoising a masked sequence — a process conceptually similar to
  "reverse diffusion" in image generation. During generation, the process
  unfolds in multiple steps:
</p>

<ol>
  <li><strong>Initialization:</strong> begin with a fully masked sequence (all tokens hidden).</li>
  <li><strong>Iterative denoising:</strong> at each step, the model predicts and fills in a subset of masked tokens. Optionally, some tokens may be re-masked and resampled to enable iterative refinement.</li>
  <li><strong>Termination:</strong> repeat this process for a fixed number of steps, or until the sequence is fully unmasked.</li>
</ol>

<p>
  This iterative, bidirectional refinement contrasts with the strictly
  left-to-right, one-pass nature of autoregressive generation.
</p>

<figure>
  <img src="{{ '/assets/img/masked-diffusion-sampling.png' | relative_url }}" alt="Iterative sampling loop for masked diffusion language models" />
  <figcaption>One step of generation: the denoising model fills in masks in $z_t$ to predict $z_s$, optionally re-masking some of its own predictions so they can be revisited on a later step.</figcaption>
</figure>

<p>
  The number of sampling steps $T$ is a free hyperparameter, typically chosen to
  be much smaller than the sequence length
  $L$<d-footnote>This is what enables the parallel-generation speedups discussed in the section on inference efficiency below.</d-footnote>.
  Despite this simple recipe, masked diffusion language models are already
  competitive with much more specialized discrete diffusion approaches, and
  close much of the likelihood gap to autoregressive models
  <d-cite key="sahoo2024simple"></d-cite>.
</p>

<figure>
  <img src="{{ '/assets/img/masked-diffusion-ppl.png' | relative_url }}" alt="Perplexity results for masked diffusion language models on LM1B" />
  <figcaption>Test perplexity on LM1B: this simple masked diffusion recipe (MDLM) outperforms prior diffusion-based language models (Diffusion-LM, D3PM, Diffusion-BERT, SEDD) and narrows the gap to an autoregressive baseline (dashed line) <d-cite key="sahoo2024simple"></d-cite>.</figcaption>
</figure>

<h2 id="key-advantages-of-diffusion-language-models">Key Advantages of Diffusion Language Models</h2>

<p>
  Beyond offering a conceptually different way to generate text, masked
  diffusion language models come with a number of concrete practical
  advantages over autoregressive models.
</p>

<h3 id="parallel-generation-and-inference-efficiency">1. Parallel Generation and Inference Efficiency</h3>

<p>
  Autoregressive (AR) language models generate text one token at a time,
  requiring $L$ sequential forward passes to produce a sequence of length $L$.
  Each token prediction depends on all previous tokens, so these computations
  cannot be parallelized — the process is inherently sequential and thus
  latency-bound by the number of tokens.
</p>

<p>
  Diffusion models are naturally suited to parallelism. Instead of producing one
  token at a time, they can generate or refine multiple tokens simultaneously at
  each step. For example, generating a 100-token sequence in $T=10$ steps means
  only 10 forward passes are needed, each updating the whole sequence at once.
  This leads to a theoretical speedup of $L/T$, and in practice this can
  accelerate inference by 5&ndash;10&times; compared to AR models
  <d-cite key="khanna2025mercury"></d-cite>. This parallelism makes diffusion
  models well-suited to latency-sensitive settings, such as conversational AI
  and real-time multimodal systems.
</p>

<details>
  <summary>Why is this actually faster in practice?</summary>
  <p>
    Although each diffusion forward pass is somewhat more expensive (since the
    model processes all tokens), modern GPUs and TPUs are highly optimized for
    parallel computation. Processing 100 tokens at once takes nearly the same
    wall-clock time as processing a single token, because the operations are
    distributed across the hardware's many cores. As a result, diffusion models
    are <strong>compute-bound</strong> — they saturate the hardware with
    parallel work — while AR models are <strong>memory-bound</strong> and
    limited by their sequential nature.
  </p>
</details>

<h3 id="retaining-variable-length-generation-and-kv-caching">2. Retaining Variable-Length Generation and KV Caching</h3>

<p>
  A frequent question about diffusion language models is how they handle
  variable-length generation and efficient key-value (KV) caching, both of
  which come naturally to AR models: AR models generate one token at a time,
  stop when an end-of-sequence token is produced, and reuse cached KVs from
  previously generated tokens to accelerate inference. Diffusion models, by
  contrast, are typically defined over fixed-length sequences, since their
  masking and denoising steps assume a predetermined number of tokens. Their
  reliance on bidirectional attention over the full sequence also prevents
  straightforward KV caching, making both flexible output lengths and efficient
  generation more challenging.
</p>

<p>
  <strong>Block diffusion</strong> is a recent advance that bridges this gap by
  combining the strengths of both autoregressive and diffusion paradigms
  <d-cite key="arriola2025block"></d-cite>. Instead of performing diffusion over
  the entire sequence at once, it generates one block of tokens at a time; within
  each block, tokens are produced in parallel using diffusion. This hybrid
  design preserves the parallelism of diffusion models while introducing
  semi-global context — that is, the model attends both within a block and to
  all previously generated blocks, rather than to the full sequence at once —
  recovering arbitrary-length generation and efficient KV caching. As a result, block diffusion is a practical framework for scalable,
  flexible text generation.
</p>

<h3 id="iterative-refinement-and-built-in-error-correction">3. Iterative Refinement and Built-in Error Correction</h3>

<p>
  A key advantage of diffusion language models is the potential for
  <strong>iterative refinement</strong> — the ability to revisit and
  progressively improve predictions over multiple denoising steps. This allows
  the model to adjust tokens as more context is revealed, enabling built-in
  error correction and higher overall output quality.
</p>

<p>
  However, standard masked diffusion models only update masked tokens at each
  step and leave previously predicted (unmasked) tokens unchanged. Once a token
  is filled in, it typically cannot be revised, limiting the true potential for
  iterative refinement. Our recent <strong>Remasking Discrete Diffusion</strong>
  sampler (<strong>ReMDM</strong>) overcomes this limitation by explicitly
  re-masking and resampling selected tokens during the denoising process
  <d-cite key="wang2025remasking"></d-cite>. By
  allowing the model to revisit and update earlier predictions, ReMDM enables
  more flexible and effective iterative refinement, resulting in more coherent
  and higher-quality text generation.
</p>

<figure>
  <img src="{{ '/assets/img/masked-diffusion-remasking.png' | relative_url }}" alt="ReMDM remasking sampler correcting an early mistake" />
  <figcaption>Example of built-in error correction: predicting the sentence "She sells sea shells," the model briefly commits to the (locally plausible but wrong) completion "sell" at $t{=}0$, then ReMDM re-masks and re-samples that token so it can be corrected later in the trajectory.</figcaption>
</figure>

<h3 id="inference-time-scaling-and-flexible-computation">4. Inference-Time Scaling and Flexible Computation</h3>

<p>
  Diffusion models introduce a new way of performing inference-time scaling. In
  contrast to autoregressive models, where the number of generation steps is
  fixed by the length of the output, diffusion models let you flexibly run more
  (or fewer) denoising steps during generation. This means you can allocate
  extra compute to produce higher-quality outputs, or save time by using fewer
  steps if perfect quality is not required.
</p>

<figure>
  <img src="{{ '/assets/img/masked-diffusion-remasking-scaling.png' | relative_url }}" alt="Inference-time scaling results" />
  <figcaption>Iterative diffusion refinement opens a new, orthogonal axis for inference-time scaling: at a fixed sequence length $L$, spending more time $T$ denoising a reasoning trace lets the model revise earlier, low-confidence tokens (shown here fading in and being rewritten across steps) rather than committing to them once and for all, as an AR model would <d-cite key="wang2025remasking"></d-cite>.</figcaption>
</figure>

<p>
  With ReMDM, you can dynamically decide where to focus more computation — by
  revisiting uncertain or important tokens — resulting in substantial
  improvements to sample quality. In practice, inference-time scaling with
  ReMDM significantly narrows the quality gap between diffusion models and
  autoregressive models.
</p>

<figure>
  <img src="{{ '/assets/img/masked-diffusion-remasking-mauve.png' | relative_url }}" alt="MAUVE score results showing inference-time scaling with ReMDM" />
  <figcaption>Generation quality (MAUVE, higher is better) as a function of inference-time compute: plain MDLM sampling scores just 0.042, simple remasking heuristics (+FB, +DFM) help some, and ReMDM closes most of the remaining gap to the autoregressive baseline (dashed line) — improving further from $T{=}1024$ to $T{=}4096$ steps <d-cite key="wang2025remasking"></d-cite>.</figcaption>
</figure>

<p>
  An especially interesting application of inference-time scaling is in
  reasoning tasks. For challenging reasoning segments, one can run additional
  refinement steps, giving the model more opportunities to improve its answers.
  On the other hand, recent work has shown that intermediate "reasoning tokens"
  can sometimes be noisy without reducing quality; in such cases, running fewer
  denoising steps can improve speed while preserving quality.
</p>

<h3 id="enhanced-controllability-and-guided-generation">5. Enhanced Controllability and Guided Generation</h3>

<p>
  Diffusion models also offer new avenues for controlled generation. A major
  reason for the success of diffusion models in image generation is their
  controllability — techniques like classifier-free guidance (CFG) and
  classifier-based guidance (CBG) have made it possible to steer image
  generation toward specific attributes or prompts.
</p>

<p>
  These guidance methods extend naturally to discrete diffusion models for
  language, enabling similar forms of control in text generation. Instead of
  relying solely on prompt engineering or costly gradient-based guidance, one
  can steer the reverse diffusion process globally — biasing denoising toward
  desired attributes like sentiment, style, or factual consistency through
  simple modifications to the denoising objective at each step.
</p>

<figure>
  <img src="{{ '/assets/img/diffusion-controlability-overview.png' | relative_url }}" alt="Overview of controllable generation with diffusion language models" />
  <figcaption>Autoregressive models can only make "local" predictions — conditioning on a fixed left-to-right context — while diffusion models make "global," iterative refinements to the whole sequence at once, which is what makes them so amenable to guidance.</figcaption>
</figure>

<p>
  Because the model refines the entire sequence iteratively, it is possible to
  inject these control signals at every step, resulting in more consistent and
  globally coherent outputs. This stands in contrast to autoregressive models,
  where control is typically limited to prompt design or early token
  constraints — interventions have only a local, left-to-right effect. This
  property has already yielded strong results in fields such as protein and DNA
  language modeling, where strict biological constraints can be enforced during
  generation, as well as in general NLP tasks.
</p>

<figure>
  <img src="{{ '/assets/img/diffusion-controlability-pareto.png' | relative_url }}" alt="Pareto frontier of controllability vs. quality" />
  <figcaption>Consider generating $x$ to maximize some property $y$, such as the binding affinity of a drug candidate. As guidance strength increases, discrete diffusion traces out a better Pareto frontier between validity/novelty and guidance-property satisfaction than an autoregressive baseline.</figcaption>
</figure>

<h3 id="unified-framework-for-multimodality">6. Unified Framework for Multimodality</h3>

<p>
  Finally, the diffusion framework generalizes across data modalities — images,
  protein sequences, DNA, audio, and more — enabling a unified approach to
  generative modeling. The same iterative denoising process and objective can be
  applied to any discrete or continuous data, with only minor modifications.
  Advances in diffusion for language modeling can often be transferred to other
  domains, and vice versa, making the approach more broadly impactful.
</p>

<h2 id="the-rise-of-large-diffusion-language-models">The Rise of Large Diffusion Language Models</h2>

<p>
  The earliest large-scale successes for diffusion models in language have come
  from biology. Protein language models are now being built with discrete
  diffusion at their core: the ESM3 model from Meta, with over 100 billion
  parameters, applies masked diffusion not just during training but also for
  sampling, simulating over 500 million years of protein evolution
  <d-cite key="hayes2025simulating"></d-cite>. These models excel at generating
  realistic and diverse protein sequences and have even been used to accelerate
  protein folding and function prediction.
</p>

<figure>
  <img src="{{ '/assets/img/diffusion-examples-esm3.png' | relative_url }}" alt="ESM3 protein diffusion language model" />
  <figcaption>ESM3, a &gt;100B-parameter protein language model, uses masked diffusion for both training and sampling, simulating over 500 million years of evolution <d-cite key="hayes2025simulating"></d-cite>.</figcaption>
</figure>

<p>
  Similarly, DNA language models have extended the masked diffusion approach to
  non-coding genomic regions. In plant genomics — where labeled data is scarce
  — recent models use discrete diffusion to capture the underlying structure of
  the genome, enabling powerful cross-species modeling of plant DNA
  <d-cite key="zhai2025dna"></d-cite>.
</p>

<figure>
  <img src="{{ '/assets/img/diffusion-examples-dna.png' | relative_url }}" alt="DNA diffusion language models" />
  <figcaption>DNA language models extend the same masked-language-modeling recipe to non-coding genomic regions, enabling zero-shot cross-species scoring — e.g. using a model trained on rice, corn, and sorghum to score a variant in cacao <d-cite key="zhai2025dna"></d-cite>.</figcaption>
</figure>

<p>
  On the natural language side, 2024&ndash;2025 has seen the first wave of
  large diffusion LLMs. LLaDA, the first open-weights, 8B-parameter diffusion
  LLM, demonstrates that masked diffusion can scale to the same regime as the
  most popular autoregressive models <d-cite key="nie2025large"></d-cite>.
  These models now rival traditional LLMs on quality, controllability, and
  downstream utility.
</p>

<figure>
  <img src="{{ '/assets/img/diffusion-examples-llm-timeline.png' | relative_url }}" alt="Timeline of large diffusion language models" />
  <figcaption>The first wave of large diffusion LLMs arrived in quick succession starting in late 2024: DiffuLLaMA, LLaDA, Mercury Coder, Dream 7B, d1-LLaDA, and Gemini Diffusion.</figcaption>
</figure>

<p>
  Importantly, this new generation of diffusion LLMs already shows clear
  advantages in achieving higher throughput without compromising quality. For
  instance, benchmarks from Artificial Analysis, a leading third-party
  evaluator, show that the diffusion model Mercury delivers performance
  comparable to speed-optimized frontier models such as GPT-4.1 Nano and Claude
  3.5 Haiku, while running more than 7&times; faster
  <d-cite key="khanna2025mercury"></d-cite>.
</p>

<figure>
  <img src="{{ '/assets/img/diffusion-examples-mercury.png' | relative_url }}" alt="Mercury diffusion language model benchmark" />
  <figcaption>Mercury matches the quality of speed-optimized frontier autoregressive models like GPT-4.1 Nano and Claude 3.5 Haiku while running more than 7&times; faster (benchmarks from Artificial Analysis) <d-cite key="khanna2025mercury"></d-cite>.</figcaption>
</figure>

<h2 id="conclusion-a-new-paradigm">Conclusion: A New Paradigm</h2>

<p>
  Masked diffusion models are emerging as a compelling alternative to
  autoregressive LMs. Their advantages of fast parallel generation, error
  correction, controllability, flexible inference-time scaling, and
  modality-agnostic modeling make them a promising direction for the next wave
  of generative AI.
</p>

<p>
  With the arrival of commercial-scale diffusion LLMs, we're just beginning to
  tap into the potential of this new paradigm.
</p>

<p><em>This post is adapted from an invited talk at the <a href="https://icml.cc/virtual/2025/52767">ICML 2025 Workshop on Long-Context Foundation Models</a>.</em></p>

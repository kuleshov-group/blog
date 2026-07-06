---
layout: distill
title: "How to Build a Diffusion Language Model"
description: "An introduction to diffusion language models and the research advances that underlie today's diffusion LLMs. We describe the building blocks of recent open source models, starting from simple masking diffusion, and including techniques for iterative refinement, post-training, and variable-length generation. This defines the main ingredients needed to build a diffusion language model today."
date: 2026-07-05
featured: true

authors:
  - name: Volodymyr Kuleshov
    url: "https://www.cs.cornell.edu/~kuleshov/"
    affiliations:
      name: Cornell University
      url: "https://www.cs.cornell.edu/"

bibliography: dllm2-blog.bib

toc:
  - name: "Introduction: Autoregressive and Diffusion Language Models"
  - name: "Background: Gaussian Diffusion"
  - name: "Simple Masked Diffusion Models"
    subsections:
      - name: "Masked Diffusion in a Nutshell"
      - name: "Understanding Masked Diffusion as Generalizing Gaussian Diffusion"
  - name: "Building a Diffusion Language Model for the Real World"
    subsections:
      - name: "Block Diffusion for Flexible-Length Generation"
      - name: "Architectures: Encoder, Decoder, and Encoder-Decoder"
      - name: "Iterative Refinement and Built-In Error Correction"
      - name: "Fast Sampling with Diffusion"
      - name: "Diffusion Enables Controllable Generation"
      - name: "Post-Training Diffusion Language Models"
  - name: "Diffusion Large Language Models Today"
    subsections:
      - name: "Biological and Scientific Domains"
      - name: "Diffusion-Based Large Language Models"
  - name: "Conclusion & Parting Thoughts"
    subsections:
      - name: "Will Diffusion Lead to Higher Intelligence? A Scaling-Law Perspective"
---

<p>
  <em>
  Adapted from ICLR 2026 &amp; MLSS 2026 talks.</em>
</p>

<h2 id="introduction-autoregressive-and-diffusion-language-models">Introduction: Autoregressive and Diffusion Language Models</h2>

<p>
  Two families of generative AI algorithms dominate today. For continuous data
  such as images or video, the state-of-the-art approach is based on
  <strong>diffusion models</strong>. For discrete data such as text or code, the
  standard approach is instead <strong>autoregressive models</strong>. This
  article explores an alternative for discrete data, one built on the modern
  paradigm of diffusion.
</p>

<p>
  Today's mainstream language models are autoregressive: they generate tokens
  left-to-right, one at a time, each conditioned on the tokens before it. This
  approach is powerful, but it also has inherent limitations:
</p>
<ul>
  <li><strong>No error correction</strong>: once a token is emitted it cannot be revised, so early mistakes compound.</li>
  <li><strong>Generation is slow</strong>: producing a sequence takes as many steps as there are tokens, and does not naturally lend itself to fast, parallel generation.</li>
  <li><strong>Causal attention</strong>: generation only ever looks backward, never at future context.</li>
</ul>

<p>
  Diffusion models take a different approach. Rather than producing text one
  token at a time, they generate the whole sequence at once, starting from an
  initial guess and iteratively refining it over a number of steps. This unlocks
  several advantages: generation can trade off speed and quality by using fewer
  or more steps, mistakes can be corrected along the way, and every step attends
  to bidirectional context.
</p>

<figure>
  <img src="{{ '/assets/img/ar-diffusion-comparison.png' | relative_url }}" alt="Autoregressive versus diffusion generation" />
  <figcaption>
    Autoregressive models generate tokens left-to-right in a fixed number of
    steps, whereas diffusion models generate all tokens in parallel and refine
    them iteratively.
  </figcaption>
</figure>

<p>
  Applying diffusion to language had long been an open problem. In 2024 the field
  reached a turning point, as diffusion models became competitive with
  autoregressive models on quality. By 2026, diffusion LLMs are a reality, with
  releases from leading industry labs &mdash; <strong>Mercury 2</strong> (Inception
  Labs) <d-cite key="khanna2025mercury"></d-cite>, <strong>Gemma Diffusion</strong>
  (Google) <d-cite key="google2026diffusiongemma"></d-cite>, and
  <strong>Nemotron Diffusion</strong> (NVIDIA) <d-cite key="fu2026nemotronlabsdiffusion"></d-cite>.
  This article traces the ideas and papers that underlie these modern models.
</p>

<h2 id="background-gaussian-diffusion">Background: Gaussian Diffusion</h2>

<p>
  Before introducing diffusion for language, we give a brief overview of
  Gaussian diffusion for image generation. We will then build up discrete diffusion by analogy. 
</p>
  
<h4>Generating by iterative denoising</h4>
  The central concept underlying diffusion models
  is <strong>denoising</strong>. Instead of painting an image in one shot, a diffusion model produces images in many steps, starting from pure random noise and removing a little of it at
  every step until a coherent image emerges. Generating an image in many
  small steps is far simpler than generating it in one shot: this is what makes diffusion models so effective.
</p>

<p>
  How does a model learn to denoise? The trick is to teach it by showing examples of noise being gradually transformed into an image. Diffusion achieves this via two complementary processes. First, a
  <strong>forward process</strong> starts with a clean source image, and generates a step-by-step transformation of that image into pure noise. Second, a
  <strong>reverse process</strong> is trained on image-to-noise transformations generated by the forward process so that it learns to transform pure noise into an image.
</p>

<h4>Forward process</h4>
<p>
  The forward process takes a clean training image and generates a sequence of noisier images that trace a transformation from clean data to pure noise. It achieves this by starting with a clean image and
  mixing in an increasing amount of random <strong>Gaussian noise</strong> at each step until the image dissolves into pure static. This step requires no learning at all &mdash; we are simply
  adding noise &mdash; but it is enormously useful, because it manufactures an
  endless supply of training data: examples of images being transformed into noise and vice versa.
</p>

<figure>
  <img src="{{ '/assets/img/diffusion-noise-dog.png' | relative_url }}" alt="Progressive noising of an image" />
  <figcaption>The forward process gradually corrupts a clean image into pure Gaussian noise.</figcaption>
</figure>

<h4>Reverse process</h4>
<p>
  The reverse process is where the actual learning happens. We train a machine learning model to transform noise into images by following the steps generated by the forward process, except in reverse.
  
  Concretely, given a noisy image,
  we train the model to <strong>separate the noise from the underlying image</strong>
  &mdash; equivalently, to predict either the noise that was added or the clean image
  itself, since given the noisy input, knowing one determines the other. 
  
  Once the
  model can do this, generation is simple: start from pure noise, ask the model to
  estimate and strip away a bit of it, and repeat. Each pass nudges the sample a
  little closer to something that looks like real data, until a clean image
  remains.
</p>

<figure>
  <img src="{{ '/assets/img/diffusion-forward-backward.png' | relative_url }}" alt="Forward and reverse diffusion" />
  <figcaption>
    Together, the forward process (adding noise) and the reverse process
    (removing it) define diffusion: generation reverses corruption, separating
    data from noise step by step.
  </figcaption>
</figure>

<p>
  This forward/reverse recipe &mdash; corrupt data with noise, then learn to
  reverse the corruption one step at a time &mdash; is the blueprint for every
  diffusion model.
</p>

<h2 id="simple-masked-diffusion-models">Simple Masked Diffusion Models</h2>

<p>
 The main obstacle in bringing diffusion to
  language is deciding what "noise" should even mean for discrete tokens.
  For example, the noise used in classical
  diffusion is Gaussian, and adding continuous Gaussian noise to categorical
  variables is not well-defined. Below we
  introduce one simple approach that defines noise via <strong>masking</strong>
  &mdash; a model that is remarkably simple yet currently among the
  highest-quality discrete diffusion methods. Our group popularized this approach<d-cite key="sahoo2024simple"></d-cite>,
  and it now forms the basis of most open-source diffusion language models.
</p>

<h3 id="masked-diffusion-in-a-nutshell">Masked Diffusion in a Nutshell</h3>
<p>
  The easiest way to understand masked diffusion is as an <strong>unmasking
  transformer</strong>. We train the model by starting from a clean sequence and
  masking a random fraction of the tokens, then asking a bidirectional transformer
  to fill in the masked values. If you are familiar with BERT, this is essentially
  BERT with a randomized masking rate &mdash; but unlike BERT, the resulting model is
  generative. You can think of masked diffusion as a <em>generative BERT</em>.
</p>

<figure>
  <img src="{{ '/assets/img/mdlm-overview-training.png' | relative_url }}" alt="Masked diffusion training" />
  <figcaption>Training: mask a random fraction of tokens and reconstruct them.</figcaption>
</figure>
<figure>
  <img src="{{ '/assets/img/mdlm-overview-sampling.png' | relative_url }}" alt="Masked diffusion sampling" />
  <figcaption>
    Sampling: start from a fully masked sequence and gradually fill in tokens in
    an arbitrary order.
  </figcaption>
</figure>

<p>
  To generate data from this model, we start with a fully masked sequence. We ask
  the model to fill in all the blanks, which yields a rough initial guess. We then
  remask most of the sequence, crucially leaving a few words unmasked, and repeat
  this process many times:
</p>
<ol>
  <li>Take the current iterate, in which part of the sequence is masked, and fill in the blanks.</li>
  <li>Remask the sequence again, but leave a few more tokens unmasked than before.</li>
</ol>
<p>
  With each round the sequence has fewer masked positions, until it converges to a
  clean sample from our model. Generation therefore looks like starting from a
  sequence full of blanks and gradually filling in words in an arbitrary order.
</p>

<figure>
  <img src="{{ '/assets/img/mdlm-generation-1.png' | relative_url }}" alt="Masked diffusion generation, step 1" />
  <figcaption>Starting point: a fully masked sequence.</figcaption>
</figure>
<figure>
  <img src="{{ '/assets/img/mdlm-generation-2.png' | relative_url }}" alt="Masked diffusion generation, step 2" />
  <figcaption>The model fills in every blank, producing an initial (rough) guess, then remasks most of it while keeping a few tokens fixed.</figcaption>
</figure>
<figure>
  <img src="{{ '/assets/img/mdlm-generation-3.png' | relative_url }}" alt="Masked diffusion generation, step 3" />
  <figcaption>Repeating this fill-in/remask loop, the fraction of unmasked tokens grows each round until the sequence converges to a clean sample.</figcaption>
</figure>

<h3 id="understanding-masked-diffusion-as-generalizing-gaussian-diffusion">Understanding Masked Diffusion as Generalizing Gaussian Diffusion</h3>
<p>
  We can understand why this process works by framing it as an analog of Gaussian
  diffusion, again consisting of a forward and reverse process.
</p>

<h4>Forward process</h4>
<p>
  The amount of masking is governed by a schedule $\alpha_t$, the probability that
  a token remains unmasked, which starts at $1$ when $t = 0$ and decreases to $0$
  when $t = 1$ (analogous to the signal-to-noise ratio in Gaussian diffusion). We
  implement the process as a Markov chain over latent variables $z_t$: for
  $s < t$, the chain defines $q(z_t \mid z_s)$ by masking each still-unmasked token
  of $z_s$ with probability $(\alpha_s - \alpha_t)/\alpha_s$. Running this Markov
  chain for a number of steps produces a trajectory going from clean data to fully
  masked noise.
</p>
<figure>
  <img src="{{ '/assets/img/mdlm-forward-1.png' | relative_url }}" alt="Masked diffusion forward process" />
  <figcaption>The forward process masks tokens at a rate governed by $\alpha_t$.</figcaption>
</figure>
<figure>
  <img src="{{ '/assets/img/mdlm-forward-2.png' | relative_url }}" alt="Masked diffusion forward process, latent chain" />
  <figcaption>The forward process defines a Markov chain over increasingly masked latent sequences $z_t$.</figcaption>
</figure>

<h4>Reverse process</h4>
<p>
  As in Gaussian diffusion, we train the reverse process to undo masking. Using
  Bayes' rule we can derive the optimal posterior $q(z_s \mid z_t, x)$ when the
  clean sequence $x$ is known: given a partially masked $z_t$, we peek at $x$ to
  find the true clean tokens, and form $z_s$ by unmasking each masked position of
  $z_t$ with probability $(\alpha_s - \alpha_t) / (1 - \alpha_t)$. In practice we
  don't know $x$ at generation time, so we train a model $x_\theta(z_t)$ to
  predict it, and define the reverse process as
  $p(z_s \mid z_t) = q\big(z_s \mid z_t, x_\theta(z_t)\big)$. This mathematical
  definition recovers exactly the fill-in/remask sampling algorithm described
  above.
</p>
<figure>
  <img src="{{ '/assets/img/mdlm-reverse-1.png' | relative_url }}" alt="Masked diffusion reverse process" />
  <figcaption>The reverse process fills in masked tokens using the model's prediction of the clean sequence.</figcaption>
</figure>

<h4>A probabilistic model for masked diffusion</h4>
<p>
  Together, the forward and reverse processes define a latent-variable model
  $p(x, z_1, \dots, z_T)$; generation corresponds to ancestral sampling. As with
  other latent-variable models, the likelihood is intractable, so we optimize an
  evidence lower bound (ELBO), which for masked diffusion has a surprisingly
  simple form: an average, over all masking rates $t$, of BERT-style
  cross-entropy losses on the masked positions <d-cite key="sahoo2024simple"></d-cite>.
  Unlike BERT, this loss is averaged over every possible masking rate rather than a
  single fixed one, and each term is normalized by $1 - \alpha_t$ to account for how
  many tokens are masked at that rate.
</p>
<p>
  Concretely, the MDLM ELBO reduces to a weighted average of masked-token
  cross-entropy losses:
</p>
$$
\mathcal{L}_\text{NELBO}
= \mathbb{E}_{t \sim \mathcal{U}[0,1]}\;
  \mathbb{E}_{q(z_t \mid x)}
  \left[
    \frac{1}{1 - \alpha_t}
    \sum_{i \,:\, z_t^i = \mathbf{m}}
    -\log p_\theta\!\left(x^i \mid z_t\right)
  \right],
$$
<p>
  where the inner sum runs over the masked positions of $z_t$ (those equal to the
  mask token $\mathbf{m}$), the term $-\log p_\theta(x^i \mid z_t)$ is the standard
  cross-entropy of the true token $x^i$, and the outer expectation averages over
  masking rates $t$.
</p>
<figure>
  <img src="{{ '/assets/img/mdlm-joint-1.png' | relative_url }}" alt="MDLM joint latent-variable model" />
  <figcaption>The forward and reverse processes jointly define a latent-variable model over $(x, z_1, \dots, z_T)$.</figcaption>
</figure>
<p>
  Most interestingly, this ELBO enables a principled likelihood (perplexity)
  comparison between autoregressive and diffusion language models &mdash; the
  standard metric for evaluating language models. While for a long time there was
  a substantial gap in perplexity between diffusion and autoregressive language
  models, simplified masked diffusion models were among the first to close much
  of this gap <d-cite key="sahoo2024simple"></d-cite>.
</p>
<figure>
  <img src="{{ '/assets/img/mdlm-elbo-ppl.png' | relative_url }}" alt="MDLM perplexity comparison" />
  <figcaption>
    The ELBO enables principled likelihood (perplexity) comparison between
    autoregressive and diffusion models.
  </figcaption>
</figure>

<h2 id="building-a-diffusion-language-model-for-the-real-world">Building a Diffusion Language Model for the Real World</h2>
<p>
  As defined above, masked diffusion models are helpful for building intuition,
  but they are not production-ready: they generate only fixed-length sequences,
  they do not support iterative refinement (error correction) out of the box, and
  they are not especially fast without additional post-training. The rest of this
  article explores extensions that address these limitations, in the context of
  modern open-weights diffusion models.
</p>

<h3 id="block-diffusion-for-flexible-length-generation">Block Diffusion for Flexible-Length Generation</h3>
<p>
  Block diffusion performs diffusion over <strong>blocks</strong> conditioned on
  previously generated tokens, enabling arbitrary-length generation
  <d-cite key="arriola2025block"></d-cite>. Blocks can range from a dozen to
  thousands of tokens depending on the application &mdash; in biological
  applications, block size might be set to match the length of the interactions
  one wants to capture, while in language modeling it is often chosen to maximize
  GPU utilization. Block diffusion also naturally supports KV caching: once a
  block is generated, its keys and values can be cached and reused when
  generating future blocks, just as in autoregressive models.
</p>
<figure>
  <img src="{{ '/assets/img/gemma-block-diffusion.png' | relative_url }}" alt="Block diffusion in Gemma Diffusion" />
  <figcaption>Block diffusion, as used in Gemma Diffusion, generates one block at a time while caching earlier blocks.</figcaption>
</figure>
<p>
  Other approaches to variable-length generation rely on connections between
  masked diffusion models and any-order autoregressive models. For instance,
  <strong>set diffusion</strong> extends block diffusion to operate over arbitrary
  sets of positions rather than left-to-right blocks. <strong>Edit Flows</strong>
  instead models generation as a sequence of insertion, deletion, and
  substitution operations, which lets the model grow or shrink the sequence as it
  refines it <d-cite key="havasi2025editflows"></d-cite>. <strong>FlexMDM</strong>
  takes a related approach within the masked diffusion framework itself,
  augmenting the reverse process with an explicit insertion mechanism so that
  pretrained MDLMs can be retrofitted to generate variable-length sequences while
  keeping any-order sampling <d-cite key="kim2025flexmdm"></d-cite>.
</p>

<h3 id="architectures-encoder-decoder-and-encoder-decoder">Architectures: Encoder, Decoder, and Encoder&ndash;Decoder</h3>
<p>
  Standard masked diffusion models are effectively <strong>encoder-only</strong>
  (like BERT), in contrast to decoder-only autoregressive models (like GPT). A key
  insight is that diffusion performs two kinds of computation &mdash; representing
  already-generated tokens and denoising corrupted ones &mdash; which motivates an
  <strong>encoder&ndash;decoder</strong> architecture with a heavy encoder and a
  lightweight decoder. This design is at the core of state-of-the-art open-source
  diffusion LLMs such as Gemma Diffusion <d-cite key="google2026diffusiongemma"></d-cite>
  and Nemotron Diffusion <d-cite key="fu2026nemotronlabsdiffusion"></d-cite>.
</p>
<figure>
  <img src="{{ '/assets/img/gemma-encdec-1.png' | relative_url }}" alt="Encoder-decoder architecture (1)" />
  <figcaption>An encoder represents clean tokens while a lightweight decoder refines the noised sequence.</figcaption>
</figure>
<figure>
  <img src="{{ '/assets/img/gemma-encdec-2.png' | relative_url }}" alt="Encoder-decoder architecture (2)" />
  <figcaption>The encoder&ndash;decoder split also reduces the FLOPs needed to train block diffusion models.</figcaption>
</figure>

<h3 id="iterative-refinement-and-built-in-error-correction">Iterative Refinement and Built-In Error Correction</h3>
<p>
  Part of the appeal of diffusion is iterative refinement. Standard MDLMs lack
  this: once a token is unmasked it can never be updated, because the forward
  masking process never remasks an unmasked token, so the model never learns to
  correct itself. Modern diffusion LMs modify the forward and reverse processes to
  restore this capability.
</p>

<h4>Remasking Diffusion</h4>
<p>
  The simplest fix is <strong>remasking</strong>: at each step we keep some newly
  unmasked tokens but also re-mask a small subset of previously unmasked tokens,
  letting them be regenerated. This can be applied to pretrained MDLMs in a
  principled way (as a predictor&ndash;corrector chain) and endows discrete diffusion
  with a form of inference-time compute scaling: increasing the number of
  sampling steps lets remasking approach autoregressive quality, while under a
  tight compute budget it better preserves quality than plain MDLM sampling
  <d-cite key="wang2025remasking"></d-cite>.
</p>
<figure>
  <img src="{{ '/assets/img/mdlm-remasking-example.png' | relative_url }}" alt="Remasking corrects an error" />
  <figcaption>Remasking lets the model flip an erroneous token back to a mask and correct it with more context.</figcaption>
</figure>
<figure>
  <img src="{{ '/assets/img/mdlm-remasking-sampling.png' | relative_url }}" alt="Remasking sampling" />
  <figcaption>Remasking as a predictor&ndash;corrector sampling procedure.</figcaption>
</figure>
<figure>
  <img src="{{ '/assets/img/mdlm-remasking-scaling.png' | relative_url }}" alt="Remasking inference-time scaling" />
  <figcaption>Increasing the number of sampling steps improves quality &mdash; inference-time scaling.</figcaption>
</figure>

<h4>Uniform State Diffusion</h4>
<p>
  Alternatively, <strong>uniform state diffusion</strong> replaces tokens with
  random tokens (rather than masks). At generation time the model sees a sequence
  with no masks and decides whether to replace each token, which naturally
  supports error correction, since any token &mdash; not just masked ones &mdash;
  can be revised at any step. Uniform diffusion language models (UDLMs) enable
  faster sampling and better controllability
  <d-cite key="schiff2024discreteguidance"></d-cite>; the open-source Gemma
  Diffusion model is a UDLM. Earlier, more general frameworks such as D3PM
  <d-cite key="austin2021structured"></d-cite> also studied uniform and other
  structured noise processes, and methods such as generalized interpolating
  discrete diffusion (GIDD) combine masking and uniform noise into a single
  process that can recover either as a special case
  <d-cite key="vonrutte2025gidd"></d-cite>.
</p>
<figure>
  <img src="{{ '/assets/img/mdlm-udlm-comparison.png' | relative_url }}" alt="MDLM versus UDLM" />
  <figcaption>Masked vs. uniform-state noise processes.</figcaption>
</figure>
<figure>
  <img src="{{ '/assets/img/udlm-overview.png' | relative_url }}" alt="Uniform-state diffusion overview" />
  <figcaption>In uniform-state diffusion, tokens are corrupted by replacement with random tokens rather than masks.</figcaption>
</figure>

<h3 id="fast-sampling-with-diffusion">Fast Sampling with Diffusion</h3>
<p>
  Because diffusion can generate or refine multiple tokens per step, it can be
  5&ndash;10&times; faster than autoregressive generation. However, sampling many
  tokens at once introduces inconsistencies (e.g., two tokens that disagree in
  grammatical number, as in the remasking example above); if the underlying noise
  process cannot correct these errors, they accumulate. This is why most fast
  diffusion models today rely on error-correcting noise processes such as
  remasking or UDLM.
</p>
<p>
  Sampling acceleration for these models is often inspired by progressive
  distillation, originally developed for Gaussian diffusion: a model is trained
  on its own generations to skip a step, and this is repeated recursively,
  halving the number of sampling steps each round
  <d-cite key="salimans2022progressive"></d-cite>. In diffusion language models,
  this idea generalizes to techniques such as self-distillation through time
  <d-cite key="deschenaux2024sdtt"></d-cite> and discrete consistency distillation
  <d-cite key="sahoo2025duo"></d-cite>. These can be interpreted as a form of
  on-policy training: standard training is off-policy, since the reverse process
  is trained on samples from the forward process rather than the samples it will
  actually see from itself at generation time. Training on the model's own
  samples in a post-processing step &mdash; too expensive to do during primary
  training &mdash; is what enables these methods to improve sampling speed.
</p>
<figure>
  <img src="{{ '/assets/img/progressive-distillation.png' | relative_url }}" alt="Progressive distillation" />
  <figcaption>Progressive distillation trains a model to take larger sampling steps, halving step count each round.</figcaption>
</figure>

<h3 id="diffusion-enables-controllable-generation">Diffusion Enables Controllable Generation</h3>
<p>
  Diffusion models excel at <strong>controllable generation</strong>: producing a
  sample $x$ that also satisfies a target property $y$, such as consistency with
  a prompt or binding affinity to a target site. Because they refine globally
  rather than committing to irreversible local edits, they navigate the sample
  space more effectively and produce samples with the target property. In
  practice, controllability manifests as a Pareto trade-off between naturalness
  (does the sample look like real data?) and property satisfaction (does it have
  the property we want?).
</p>
<figure>
  <img src="{{ '/assets/img/udlm-guidance-overview.png' | relative_url }}" alt="Guidance overview" />
  <figcaption>Guidance steers generation toward samples with a desired property $y$.</figcaption>
</figure>
<p>
  Discrete diffusion supports natural analogs of classic continuous-diffusion
  guidance techniques, classifier-based guidance (CBG) and classifier-free
  guidance (CFG) <d-cite key="schiff2024discreteguidance"></d-cite>. In CBG, if we
  have a predictor $p(y \mid x)$ of the target property $y$ given a sample $x$,
  we can use it at each denoising step to guide generation and provably sample
  from the conditional distribution $p(x \mid y) \propto p(y \mid x) p(x)$. Both
  techniques extend naturally to MDLM and UDLM, and are especially effective when
  combined with UDLM or with MDLM plus remasking, since both support revising
  tokens repeatedly as guidance is applied.
</p>
<figure>
  <img src="{{ '/assets/img/udlm-guidance-formula-cfg.png' | relative_url }}" alt="Classifier-free guidance" />
  <figcaption>Classifier-free guidance (CFG) for discrete diffusion.</figcaption>
</figure>
<figure>
  <img src="{{ '/assets/img/udlm-guidance-formula-cbg.png' | relative_url }}" alt="Classifier-based guidance" />
  <figcaption>Classifier-based guidance (CBG) using a property predictor $p(y \mid x)$.</figcaption>
</figure>
<figure>
  <img src="{{ '/assets/img/udlm-guidance-pareto.png' | relative_url }}" alt="Guidance Pareto frontier" />
  <figcaption>The naturalness&ndash;vs&ndash;property Pareto frontier for autoregressive and diffusion models.</figcaption>
</figure>

<h3 id="post-training-diffusion-language-models">Post-Training Diffusion Language Models</h3>
<p>
  Diffusion language models can also be post-trained with reinforcement learning
  to improve reasoning, following the same broad recipe that has driven recent
  gains in autoregressive LLMs. The main complication is that RL algorithms like
  policy gradient methods need the likelihood of a sampled trajectory, which is
  easy for autoregressive models (a simple product of next-token probabilities)
  but expensive for masked diffusion models, whose training objective averages
  over all masking orders. <strong>d1</strong> introduces diffu-GRPO, a critic-free
  policy-gradient algorithm that estimates these trajectory log-probabilities
  with a mean-field approximation, combined with masked supervised fine-tuning to
  distill reasoning behavior from existing datasets
  <d-cite key="zhao2025d1"></d-cite>. <strong>d2</strong> improves on this by
  deriving more accurate likelihood estimators &mdash; an exact one-pass estimator
  for models that support any-order decoding, and an approximate estimator with a
  tunable compute&ndash;accuracy trade-off otherwise &mdash; yielding a new
  state of the art on logical and math reasoning benchmarks without relying on
  supervised fine-tuning at all <d-cite key="wang2025d2"></d-cite>.
</p>
<p>
  Post-training with RL is also central to biological applications of diffusion
  language models, where the desired reward is often an experimentally measured
  property (e.g., binding affinity or gene expression) rather than a
  verifiable answer. Methods such as DRAKES back-propagate this kind of reward
  through the sampling trajectory of a discrete diffusion model to fine-tune it
  directly for DNA and protein design <d-cite key="wang2024drakes"></d-cite>, and
  a broader tutorial surveys the space of RL-based fine-tuning algorithms for
  diffusion models more generally <d-cite key="uehara2024tutorial"></d-cite>.
</p>

<h2 id="diffusion-large-language-models-today">Diffusion Large Language Models Today</h2>

<h3 id="biological-and-scientific-domains">Biological and Scientific Domains</h3>
<p>
  One of the first success areas of diffusion language models has been scientific
  applications, particularly biological sequences. Biological sequences are less
  likely to exhibit the left-to-right biases baked into autoregressive models, and
  scientific applications often require controllable generation &mdash; a natural
  strength of diffusion.
</p>

<h4>Protein Sequence Modeling</h4>
<p>
  <strong>ESM3</strong> implements MDLM at up to 100B parameters trained on massive
  amino-acid databases. Its training and sampling algorithms match those described
  above; developed concurrently with MDLM, it reported that this BERT-style approach
  outperformed autoregressive baselines and recently set a new state of the art in
  protein generation <d-cite key="hayes2025simulating"></d-cite>.
</p>
<figure>
  <img src="{{ '/assets/img/examples-esm3.png' | relative_url }}" alt="ESM3 examples" />
  <figcaption>ESM3 applies masked diffusion to protein sequences at scale.</figcaption>
</figure>

<h4>Nucleotide Sequence Modeling</h4>
<p>
  Proteins are the building blocks of life, but their activity is heavily
  regulated by non-coding genomic sequences that fall outside the scope of
  protein models like ESM3. The <strong>Nucleotide Transformer v3 (NT-v3)</strong>
  family scales MDLM to billions of parameters and over a trillion tokens of DNA,
  trained on multi-track data that includes gene-expression levels alongside raw
  sequence. At inference time, these tracks support discrete classifier-free
  guidance with remasking, enabling generation of DNA sequences with target
  properties &mdash; validated experimentally in the wet lab, where guided NT-v3
  generations modulated gene expression better than prior baselines
  <d-cite key="boshar2025ntv3"></d-cite>.
</p>
<figure>
  <img src="{{ '/assets/img/examples-ntv3.png' | relative_url }}" alt="NT-v3" />
  <figcaption>NT-v3 scales masked diffusion to genomic sequences.</figcaption>
</figure>
<figure>
  <img src="{{ '/assets/img/examples-ntv3-experiment.png' | relative_url }}" alt="NT-v3 wet-lab experiment" />
  <figcaption>Guided NT-v3 generations modulate gene expression better than prior baselines in wet-lab tests.</figcaption>
</figure>

<h3 id="diffusion-based-large-language-models">Diffusion-Based Large Language Models</h3>
<p>
  Over the last 18 months, diffusion large language models have emerged rapidly.
</p>

<h4>LLaDA</h4>
<p>
  <strong>LLaDA</strong> scaled MDLM to 8B parameters, emulating the LLaMA recipe,
  with an MDLM backbone, block diffusion at sampling time, and compatibility with
  remasking and post-training. It is open-weights and reports favorable scaling
  versus autoregressive models <d-cite key="nie2025large"></d-cite>.
</p>
<figure>
  <img src="{{ '/assets/img/examples-llada.png' | relative_url }}" alt="LLaDA" />
  <figcaption>LLaDA: an 8B-parameter open-weights diffusion LLM.</figcaption>
</figure>

<h4>Mercury</h4>
<p>
  <strong>Mercury</strong> is the first commercial diffusion LLM, announced in
  February 2025. Its differentiator is speed: leveraging parallel generation, it
  exceeds 1,000 tok/sec/user on standard GPUs while matching the quality of its
  class. Mercury 2 rivals speed-optimized frontier models (Claude Haiku, Gemini
  Flash-Lite/Flash) at 5&ndash;10&times; the speed <d-cite key="khanna2025mercury"></d-cite>.
</p>
<figure>
  <img src="{{ '/assets/img/examples-mercury-chips.png' | relative_url }}" alt="Mercury speed on chips" />
  <figcaption>Mercury achieves specialized-hardware-level speeds on standard GPUs.</figcaption>
</figure>
<figure>
  <img src="{{ '/assets/img/examples-mercury-point-cloud.png' | relative_url }}" alt="Mercury quality vs speed" />
  <figcaption>Mercury 2 quality vs. speed against frontier models.</figcaption>
</figure>

<h4>Gemma Diffusion</h4>
<p>
  <strong>Gemma Diffusion</strong> is a modern open-weights diffusion model from
  Google, widely supported in popular frameworks including Unsloth and Hugging
  Face <d-cite key="google2026diffusiongemma"></d-cite>. It combines a UDLM
  backbone, block diffusion for generating variable-length sequences, an
  encoder&ndash;decoder architecture, and accelerated sampling &mdash; shifting
  the generation bottleneck from memory bandwidth to compute by denoising an
  entire block ("canvas") of tokens in parallel on each forward pass, rather than
  emitting a single token at a time.
</p>

<h2 id="conclusion-parting-thoughts">Conclusion &amp; Parting Thoughts</h2>
<p>
  The field of diffusion language models has exploded over the past two years, with
  production-grade dLLM releases from multiple frontier labs. Diffusion offers
  potential advantages over autoregressive models in <strong>speed</strong> (up to
  10&times; via parallel generation), <strong>controllability</strong> (iterative
  refinement for property-targeted generation), <strong>multi-modality</strong> (a
  single algorithmic approach across images and text), and
  <strong>inference-time scaling</strong>. Diffusion has not yet been scaled to the
  same parameters, compute, and data as autoregressive models, but experiments at up
  to 100B parameters show significant promise.
</p>

<h3 id="will-diffusion-lead-to-higher-intelligence-a-scaling-law-perspective">Will Diffusion Lead to Higher Intelligence? A Scaling-Law Perspective</h3>
<p>
  A question the authors often receive: can diffusion eventually yield fundamental
  improvements in intelligence? From a scaling-law perspective, the transformer
  unlocked pre-training scaling because it made training <em>parallel</em>, whereas
  RNNs did not scale. Since 2024, intelligence gains have shifted to post-training and
  inference-time scaling &mdash; both bottlenecked by <em>sequential</em> generation. We
  view diffusion as the approach that could make inference fully parallel: diffusion
  may be to inference-time and post-training scaling what the transformer was to
  pre-training scaling. It is early, but in our opinion the prize is large.
</p>

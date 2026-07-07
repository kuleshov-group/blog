---
layout: distill
title: "How to Build a Diffusion Language Model"
description: "An introduction to diffusion language models and the research advances that underlie today's diffusion LLMs. We describe the building blocks of recent open source models, starting from simple masking diffusion, and including techniques for iterative refinement, post-training, and variable-length generation. This defines the main ingredients needed to build a diffusion language model today. Material is adapted from workshop talks and lectures at ICLR 2026 and MLSS 2026."
date: 2026-07-05
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

bibliography: dllm2-blog.bib

_styles: >
  d-article d-contents {
    grid-row: auto / span 8;
  }

toc:
  - name: "Introduction: Autoregressive and Diffusion Language Models"
  - name: "Background: Gaussian Diffusion"
  - name: "Simple Masked Diffusion Models"
    subsections:
      - name: "Masked Diffusion in a Nutshell"
      - name: "Understanding Masked Diffusion as Generalizing Gaussian Diffusion"
  - name: "Building a Real-World Diffusion Language Model"
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
      - name: "Is Diffusion A Path Towards More Intelligent Models? A Scaling-Law Perspective"
---

<h2 id="introduction-autoregressive-and-diffusion-language-models">Introduction: Autoregressive and Diffusion Language Models</h2>

<p>
  Two families of generative AI algorithms are widely used today. For continuous data
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
  Before introducing diffusion for language, we start with a brief overview of
  Gaussian diffusion for image generation. We will then build up discrete
  diffusion by analogy.
</p>

<h4>Generating by iterative denoising</h4>
<p>
  The central concept underlying diffusion models is <strong>denoising</strong>.
  Instead of painting an image in one shot, a diffusion model produces images
  step by step, starting from pure random noise and removing a little of it at
  every step until a coherent image emerges. Generating an image through many
  small steps turns out to be far simpler than producing it all at once, and this
  is what makes diffusion models so effective.
</p>

<p>
  How does a model learn to denoise? The trick is to teach it by showing examples of 
  noise being gradually transformed into an image. Diffusion achieves this via
  two complementary processes. First, a <strong>forward process</strong> takes a
  clean source image and turns it into pure noise, one step at a time. Second, a
  <strong>reverse process</strong> learns to invert this transformation, turning
  pure noise back into an image; it is trained on the image-to-noise trajectories
  produced by the forward process.
</p>

<h4>Forward process</h4>
<p>
  The forward process takes a clean training image and produces a sequence of
  increasingly noisy images that trace a path from clean data to pure noise. It
  does this by mixing in a growing amount of random <strong>Gaussian noise</strong>
  at each step, until the image dissolves into pure static. This step requires no
  learning at all &mdash; we are simply adding noise &mdash; yet it is enormously
  useful, because it manufactures an endless supply of training data: examples of
  images being transformed into noise, and vice versa.
</p>

<figure>
  <img src="{{ '/assets/img/diffusion-noise-dog.png' | relative_url }}" alt="Progressive noising of an image" />
  <figcaption>The forward process gradually corrupts a clean image into pure Gaussian noise.</figcaption>
</figure>

<h4>Reverse process</h4>
<p>
  The reverse process is where the actual learning happens. We train a model to
  transform noise into images by following the steps produced by the forward process in reverse.
  
  Concretely, given a noisy image, we train a machine learning model to
  <strong>separate the noise from the underlying image</strong> &mdash;
  equivalently, to predict either the noise that was added or the clean image
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
  language is deciding what "noise" should mean for discrete tokens.
  For example, the noise used in classical
  diffusion is Gaussian, and adding continuous Gaussian noise to categorical
  variables is not well-defined. Below we
  introduce one simple yet effective  approachthat defines noise via <strong>masking</strong>. Our group popularized this approach<d-cite key="sahoo2024simple"></d-cite>,
  and it now forms the basis of most open-source diffusion language models.
</p>

<h3 id="masked-diffusion-in-a-nutshell">Masked Diffusion in a Nutshell</h3>
<p>
  The easiest way to understand masked diffusion is as an <strong>unmasking
  transformer</strong>. We train the model by taking clean sequences, masking a
  random fraction of their tokens, and asking a bidirectional transformer to fill in
  the blanks. If you know BERT, this is essentially BERT with a randomized masking
  rate &mdash; but unlike BERT, the resulting model is generative. You can think of
  masked diffusion as a <em>generative BERT</em>.
</p>

<figure>
  <img src="{{ '/assets/img/mdlm-overview-training.png' | relative_url }}" alt="Masked diffusion training" />
  <figcaption>Training: mask a random fraction of tokens and reconstruct them.</figcaption>
</figure>

<p>
  Once we trained the unmasking transformer, we can generate text by starting from a fully masked sequence and repeating two steps many
  times:
</p>
<ol>
  <li><strong>Infilling</strong>: Ask the model to fill in every blank in the current sequence, yielding a rough guess of the clean tokens.</li>
  <li><strong>Remasking</strong>: Randomly re-noise the infilled sequence by replacing tokens with masks, but keep a few more tokens unmasked than in the previous round.</li>
</ol>
<figure>
  <img src="{{ '/assets/img/mdlm-overview-sampling.png' | relative_url }}" alt="Masked diffusion sampling" />
  <figcaption>
    Sampling: start from a fully masked sequence and gradually fill in tokens in
    an arbitrary order.
  </figcaption>
</figure>
<p>
  Each round leaves fewer positions masked, until the sequence converges to a clean
  sample from the model. Generation thus amounts to starting from a sequence full of
  blanks and gradually filling in words in an arbitrary order.
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

<h3 id="understanding-masked-diffusion-as-generalizing-gaussian-diffusion">Understanding Masked Diffusion: A Probabilistic Perspective</h3>
<p>
  We
  can also understand a bit better <em>why</em> this process works by framing it as
  an analog of the Gaussian diffusion model we saw earlier. 
  Just like Gaussian
  diffusion, masked diffusion can be described as a model consisting of
  a forward and a reverse process.
</p>

<h4>Forward process</h4>
<p>
  The goal of the forward process is to generate training data for the reverse
  process. Its output is a trajectory that starts from a datapoint and ends at
  a sequence of pure noise; the reverse process will then be trained to produce this
  trajectory in reverse.
</p>
<p>
  The key challenge is deciding what "noisy" should mean. In Gaussian diffusion, we
  added varying amounts of white noise to an image. In masked diffusion, we instead
  randomly mask a fraction of the tokens in a discrete sequence. The amount of
  masking is governed by a schedule $\alpha_t$ &mdash; the probability that a given
  token remains unmasked &mdash; which plays the role of the signal-to-noise ratio
  in Gaussian diffusion. It starts at $1$ when $t = 0$ (a clean sequence) and
  decreases to $0$ when $t = 1$ (a fully masked sequence). The time variable $t$
  indexes a path from clean to noisy data, and at time $t$ a partially masked
  sequence has, in expectation, a fraction $\alpha_t$ of its tokens unmasked.
</p>
<figure>
  <img src="{{ '/assets/img/mdlm-forward-1.png' | relative_url }}" alt="Masked diffusion forward process" />
  <figcaption>The forward process masks tokens at a rate governed by $\alpha_t$.</figcaption>
</figure>
<p>
  We implement this process as a Markov chain over a sequence of
  variables $z_t$ indexed by $t$, with $z_0$ being the clean, unmasked sequence. For
  $s < t$, the chain defines $q(z_t \mid z_s)$ by masking each still-unmasked token
  of $z_s$ with probability $(\alpha_s - \alpha_t)/\alpha_s$. Running this Markov
  chain for a number of steps produces a trajectory going from clean data to fully
  masked noise.
</p>
<figure>
  <img src="{{ '/assets/img/mdlm-forward-2.png' | relative_url }}" alt="Masked diffusion forward process, latent chain" />
  <figcaption>The forward process defines a Markov chain over increasingly masked latent sequences $z_t$.</figcaption>
</figure>

<h4>Reverse process</h4>
<p>
  Next, as in Gaussian diffusion, we train the reverse process to walk the sequence
  of increasingly masked latents in reverse &mdash; starting from a fully masked
  sequence and ultimately generating outputs similar to clean data.
</p>
<p>
  Using Bayes' rule, we can derive an ideal reverse process $q(z_s \mid z_t, x)$ when the clean sequence $x$ is <em>known</em> <d-cite key="sahoo2024simple"></d-cite>. Given a partially masked $z_t$, this process will
  peek at $x$ to find the true clean tokens, and form $z_s$ by replacing each masked
  position of $z_t$ with its value in $x$ with probability $(\alpha_s - \alpha_t) / (1 - \alpha_t)$, and otherwise leaving it masked.
</p>
<p>
  In practice, the final output $x$ is obviously unknown when we generate it. We therefore train a model $x_\theta(z_t)$ to predict the final clean sequence given the
  current state $z_t$ and apply the ideal reverse process
  $q(z_s \mid z_t, x)$ using the estimate $x_\theta(z_t)$ in place of the real
  $x$. More formally, we define the reverse process as a probability
  $p(z_s \mid z_t) = q\big(z_s \mid z_t, x_\theta(z_t)\big)$. This
  mathematical definition recovers exactly the sampling algorithm we described
  earlier: at each step, we use the model $x_\theta(z_t)$ to fill in the blanks of
  $z_t$, and we keep a subset of these filled-in tokens in $z_s$.
</p>
<figure>
  <img src="{{ '/assets/img/mdlm-reverse-1.png' | relative_url }}" alt="Masked diffusion reverse process" />
  <figcaption>The reverse process fills in masked tokens using the model's prediction of the clean sequence.</figcaption>
</figure>

<h4>A probabilistic model for masked diffusion</h4>
<p>
  Putting these pieces together gives us the mathematical definition of a
  masked diffusion language model (MDLM). The forward process $q(z_t \mid z_s)$
  produces a trajectory from clean to fully masked data, and the reverse process
  $p(z_s \mid z_t)$ learns to undo it. Moreover, the reverse process
  defines a latent variable model whose joint distribution
  $p(x, z_1, \dots, z_T)$ factorizes as a product of terms $p(z_s \mid z_t)$
  for some number of time steps $T$. Generation in this diffusion model corresponds
  to ancestral sampling.
</p>
<figure>
  <img src="{{ '/assets/img/mdlm-joint-1.png' | relative_url }}" alt="MDLM joint latent-variable model" />
  <figcaption>The forward and reverse processes jointly define a latent-variable model over $(x, z_1, \dots, z_T)$.</figcaption>
</figure>
<p>
  Given a probabilistic model, we can look at its likelihood
  $\log p(x)$ as a way to assess its fit to the data. In latent variable models this is typically intractable, so we resort
  to approximations via variational inference. For a masked diffusion language
  model, the evidence lower bound (ELBO) used to approximate the likelihood has a
  surprisingly simple form <d-cite key="sahoo2024simple"></d-cite>:
</p>

$$
\mathcal{L}_\text{ELBO}
= \mathbb{E}_{t \sim \mathcal{U}[0,1]}\;
  \mathbb{E}_{q(z_t \mid x)}
  \left[
    \frac{1}{1 - \alpha_t}\,
    \log p_\theta\!\left(x \mid z_t\right)
  \right].
$$

<p>
  Let's unpack this formula. The inner term $\log p_\theta(x \mid z_t)$ is the
  likelihood of a clean sequence $x$ under our model, given a partially masked
  sequence $z_t$ sampled from the forward process. In other words, it is the
  cross-entropy loss between the predictions of our unmasking transformer and the
  true tokens &mdash; this is exactly the BERT loss!
</p>
<p>
  Differently from BERT, this loss is averaged over all $t$, and hence over all
  possible masking rates, rather than a single fixed one. It is also normalized by
  $1 - \alpha_t$, the expected fraction of tokens that are masked at rate $t$; this
  factor ensures that each BERT loss is normalized for the number of tokens over
  which the loss is taken.
</p>

<h4>Summarizing and Evaluating Masked Diffusion</h4>

<p>
  In summary, MDLM is very similar to BERT, with two key differences:
</p>
<ul>
  <li>
    It admits principled sampling algorithms, corresponding to ancestral sampling
    in a latent variable model.
  </li>
  <li>
    Training uses a randomized masking rate, which corresponds to a
    principled variational lower bound on the log-likelihood.
  </li>
</ul>
<p>
  Most interestingly, the evidence lower bound enables a principled comparison
  between autoregressive and diffusion language models using log-likelihood (or,
  equivalently, perplexity) &mdash; the standard metric for evaluating language
  models. While for a long time there was a substantial gap in perplexity between
  diffusion and autoregressive language models, simplified masked diffusion models
  were among the first to close much of this gap <d-cite key="sahoo2024simple"></d-cite>.
</p>
<figure>
  <img src="{{ '/assets/img/mdlm-elbo-ppl.png' | relative_url }}" alt="MDLM perplexity comparison" />
  <figcaption>
    The ELBO enables principled likelihood (perplexity) comparison between
    autoregressive and diffusion models.
  </figcaption>
</figure>

<h2 id="building-a-real-world-diffusion-language-model">Building a Real-World Diffusion Language Model</h2>
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
  The first issue that arises with standard MDLMs is their limitation
  to generating fixed-length sequences. Block diffusion addresses this limitation by performing
  diffusion over <strong>blocks</strong>, conditioned on previously generated
  tokens <d-cite key="arriola2025block"></d-cite>. These blocks can be of arbitrary
  size, ranging from a dozen to thousands of tokens, and should ideally depend on
  the application domain.
</p>
<figure>
  <img src="{{ '/assets/img/gemma-block-diffusion.png' | relative_url }}" alt="Block diffusion in Gemma Diffusion" />
  <figcaption>Block diffusion, as used in Gemma Diffusion, generates one block at a time while caching earlier blocks.</figcaption>
</figure>
<p>
  For example, in biological applications, we might have prior knowledge about the length of the
  interactions we want to capture, and set the block size to the minimum length
  needed to capture them. In language modeling, we may instead be interested in
  maximizing GPU utilization; in that case we would choose the block size so that
  the arithmetic intensity of our forward pass (which also depends on the batch
  size) matches that of the underlying hardware.
</p>
<p>
  Additionally, block diffusion naturally supports <strong>KV caching</strong>, a
  technique that accelerates sequence generation in autoregressive models. Once a block has been generated using a transformer architecture, its keys and
  values can be cached and reused when generating future blocks.
</p>
<p>
Other approaches to variable-length generation rely on connections between masked diffusion models and any-order autoregressive models. For instance,
  <strong>Set Diffusion</strong> extends block diffusion to operate over arbitrary
  sets of positions rather than left-to-right blocks. Other approaches, such as <strong>Edit Flows</strong> <d-cite key="havasi2025editflows"></d-cite> or <strong>FlexMDM</strong><d-cite key="kim2025flexmdm"></d-cite>
  instead model generation as a sequence of insertion, deletion, and
  substitution operations, which lets the model grow or shrink the sequence as it
  refines it.
</p>

<h3 id="architectures-encoder-decoder-and-encoder-decoder">Architectures: Encoder, Decoder, and Encoder&ndash;Decoder</h3>
<p>
  Standard masked diffusion models are effectively <strong>encoder-only</strong>
  (like BERT), in contrast to decoder-only autoregressive models (like GPT).
  Using an encoder-only architecture requires sampling algorithms that invoke the
  full network at every denoising step, which can incur a relatively high
  computational cost.
</p>
<p>
 A key
  insight is that diffusion performs two kinds of computation: (1) computing a
  representation of the tokens that have been generated so far, and (2) denoising
  the corrupted tokens. This observation suggests using separate modules for each
  task. The result is an <strong>encoder&ndash;decoder</strong> architecture, which
  relies on an encoder to represent clean tokens and a lightweight decoder to
  iteratively refine a noised sequence. Encoder&ndash;decoder architectures are at
  the core of state-of-the-art open-source diffusion LLMs, such as Gemma Diffusion
  <d-cite key="google2026diffusiongemma"></d-cite> and the recent Nemotron
  Diffusion models <d-cite key="fu2026nemotronlabsdiffusion"></d-cite>.
</p>
<figure>
  <img src="{{ '/assets/img/gemma-encdec-1.png' | relative_url }}" alt="Encoder-decoder architecture (1)" />
  <figcaption>An encoder represents clean tokens while a lightweight decoder refines the noised sequence.</figcaption>
</figure>
<p>
  In addition to accelerating discrete diffusion inference, this architecture
  enables faster <em>training</em> of block diffusion models: after partitioning a
  sequence into blocks, we pass the blocks into a smaller decoder at training time,
  which reduces the number of FLOPs needed for training.
</p>

<h3 id="iterative-refinement-and-built-in-error-correction">Iterative Refinement and Built-In Error Correction</h3>
<p>
  Part of the appeal of diffusion is iterative refinement. Standard MDLMs lack
  this: once a token is unmasked it can never be updated, because the forward
  masking process never remasks an unmasked token, so the model never learns to
  correct itself. Modern diffusion LMs modify the forward and reverse processes to
  restore this capability.
</p>

<figure>
  <img src="{{ '/assets/img/mdlm-joint-1.png' | relative_url }}" alt="MDLM joint latent-variable model" />
  <figcaption>Masked diffusion does not support error correction [need to expand this]</figcaption>
</figure>

<h4>Remasking Diffusion</h4>
<p>
  The simplest fix is <strong>remasking</strong>: at each step we keep some newly
  unmasked tokens but also re-mask a small subset of previously unmasked tokens,
  letting them be regenerated. Concretely, consider the example below, in which a masked diffusion model introduces a grammatical error. With remasking, this token flips to a mask and then gets corrected when the model receives additional context.
</p>
<figure>
  <img src="{{ '/assets/img/mdlm-remasking-example.png' | relative_url }}" alt="Remasking corrects an error" />
  <figcaption>Remasking lets the model flip an erroneous token back to a mask and correct it with more context.</figcaption>
</figure>

<p>
Remasking can be applied to standard pretrained MDLMs in a
  principled way as a plug-in sampler (formally, it can be seen as implementing a predictor&ndash;corrector Markov chain <d-cite key="campbell2022continuous"></d-cite>). Most interestingly, it endows discrete diffusion
  with a form of inference-time compute scaling: increasing the number of
  sampling steps lets remasking approach autoregressive quality, while under a
  tight compute budget it better preserves quality than plain MDLM sampling
  <d-cite key="wang2025remasking"></d-cite>.
</p>

<figure>
  <img src="{{ '/assets/img/mdlm-remasking-scaling.png' | relative_url }}" alt="Remasking inference-time scaling" />
  <figcaption>Increasing the number of sampling steps improves quality &mdash; inference-time scaling.</figcaption>
</figure>

<h4>Uniform State Diffusion</h4>
<p>
  Alternatively, we may use an entirely different type of forward and reverse process than masking.
  Uniform state diffusion is perhaps the most common alternative discrete form of noise.
  Instead of masking, its forward process replaces tokens with random ones in the vocabulary.
  The reverse process starts with a random sequences and flips tokens until the result looks like data.
</p>
<figure>
  <img src="{{ '/assets/img/mdlm-udlm-comparison.png' | relative_url }}" alt="MDLM versus UDLM" />
  <figcaption>Masked vs. uniform-state noise processes.</figcaption>
</figure>

<p>
  At generation time the model sees a sequence
  with no masks and decides whether to replace each token, which naturally
  supports error correction, since any token &mdash; not just masked ones &mdash;
  can be revised at any step. 
  While masked diffusion models typically train faster (achieving better perplexities), uniform diffusion language models (UDLMs) facilitate faster sampling <d-cite key="sahoo2025duo"></d-cite> and better controllability <d-cite key="schiff2024discreteguidance"></d-cite>, as we will discuss below. For instance, the open source Gemma diffusion model is a UDLM.
</p>

<figure>
  <img src="{{ '/assets/img/udlm-overview.png' | relative_url }}" alt="Uniform-state diffusion overview" />
  <figcaption>In uniform-state diffusion, tokens are corrupted by replacement with random tokens rather than masks.</figcaption>
</figure>

<p>
Like MDLM, UDLM supports a simplified evidence lower bound objective that improves training <d-cite key="schiff2024discreteguidance"></d-cite>.
Earlier, more general frameworks such as D3PM
  <d-cite key="austin2021structured"></d-cite> also studied uniform and other
  structured noise processes, and methods such as generalized interpolating
  discrete diffusion (GIDD) combine masking and uniform noise into a single
  process that can recover either as a special case
  <d-cite key="vonrutte2025gidd"></d-cite>.
</p>

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
  distillation <d-cite key="salimans2022progressive"></d-cite>: a model is trained
  on its own generations to skip a step, and this is repeated recursively,
  halving the number of sampling steps each round. In diffusion language models,
  this idea generalizes to techniques such as self-distillation through time
  <d-cite key="deschenaux2024sdtt"></d-cite> and discrete consistency distillation
  <d-cite key="sahoo2025duo"></d-cite>.
</p>
<figure>
  <img src="{{ '/assets/img/progressive-distillation.png' | relative_url }}" alt="Progressive distillation" />
  <figcaption>Progressive distillation trains a model to take larger sampling steps, halving step count each round.</figcaption>
</figure>

<p>
These can be interpreted as a form of
  on-policy training: standard training is off-policy, since the reverse process
  is trained on samples from the forward process rather than the samples it will
  actually see from itself at generation time. Training on the model's own
  samples in a post-processing step &mdash; too expensive to do during primary
  training &mdash; is what enables these methods to improve sampling speed.
</p>

<h3 id="diffusion-enables-controllable-generation">Diffusion Enables Controllable Generation</h3>
<p>
  Diffusion models excel at <strong>controllable generation</strong>: producing a
  sample $x$ that also satisfies a target property $y$, such as consistency with
  a prompt if $x$ is an image or binding affinity to a target site if $x$ is a molecule. Because they refine globally
  rather than committing to irreversible local edits, diffusion models navigate the sample
  space more effectively and produce better samples with the target property.
</p>

<p>
In practice, controllability manifests as a Pareto trade-off between naturalness
  (does the sample look like real data?) and property satisfaction (does it have
  the property we want?).
  For example, we could ask the model to produce, molecules that look natural, but they might not have the binding affinity we seek. Coversely, we could optimize for binding affinity, but the outputs might not look like natural molecules and not be synthesizable. These two considerations induce a Pareto frontier on which diffusion improves over autoregression.
</p>

<figure>
  <img src="{{ '/assets/img/udlm-guidance-pareto.png' | relative_url }}" alt="Guidance Pareto frontier" />
  <figcaption>The naturalness&ndash;vs&ndash;property Pareto frontier for autoregressive and diffusion models.</figcaption>
</figure>

<h4>Algorithms for controllable generation</h4>

<p>
  Diffusion models are especially effective at controllable generation via
  techniques such as <strong>classifier-based guidance</strong> (CBG) and
  <strong>classifier-free guidance</strong> (CFG). For example, in CBG, if we have
  a predictor model $p(y \mid x)$ of the target property $y$ given a sample $x$, we
  can use this model at each step to guide the generation process and provably
  yield a sample from the conditional distribution
  $p(x \mid y) \propto p(y \mid x)\, p(x)$.
</p>

<figure>
  <img src="{{ '/assets/img/udlm-guidance-overview.png' | relative_url }}" alt="Guidance overview" />
  <figcaption>Guidance steers generation toward samples with a desired property $y$.</figcaption>
</figure>

<p>
  Both
  techniques extend naturally to MDLM and UDLM <d-cite key="schiff2024discreteguidance"></d-cite>, and are especially effective when
  combined with UDLM or with MDLM plus remasking, since both support revising
  tokens repeatedly as guidance is applied.
</p>

<details>
  <summary>Discrete classifier-based guidance (D-CBG): the math</summary>
  <p>
    By Bayes' rule, any conditional reverse process decomposes as follows:
  </p>
  $$
  \underbrace{\log p(z_s \mid z_t, y)}_{\text{conditional distribution}}
  = \underbrace{\log p(y \mid z_t, z_s)}_{\text{predictive term}}
  + \underbrace{\log p(z_s \mid z_t)}_{\text{unconditional term}}
  + c,
  $$
  <p>
    where $c$ is a log-normalization constant. Now suppose we have a classifier $p(y \mid z_t)$ of the property $y$ from a noisy sequence $z_t$, as well as an unconditional diffusion model. We can plug them into the right hand side of the above equation to construct a conditional model from these two individual components.
  </p>
  $$
  \underbrace{\log p^{(\gamma)}(z_s \mid z_t, y)}_{\text{new unnormalized distribution}}
  = \gamma\, \underbrace{\log p(y \mid z_s, z_t)}_{\text{guidance term}}
  + \underbrace{\log p(z_s \mid z_t)}_{\text{original diffusion model}},
  $$
  <p>
    where $\gamma > 0$ is a guidance strength parameter that trades off the property
    against the model's own preferences. For a <em>single</em> token, the left-hand-side distribution is easy to normalize: we simply sum over the $N$ possible values of
    that token in the vocabulary. Extending this to a full sequence $z_t^{(1:L)}$ of length $L$ requires additional normalization techniques <d-cite key="schiff2024discreteguidance"></d-cite>.
  </p>
</details>

<details>
  <summary>Discrete classifier-free guidance (D-CFG): the math</summary>
  <p>
    Instead of training a separate classifier, suppose we have a conditional model
    $p(z_s \mid z_t, y)$ and an unconditional model $p(z_s \mid z_t)$. Recall the CBG
    factorization from above,
  </p>
  $$
  \log p^{(\gamma)}(z_s \mid z_t, y)
  = \gamma \cdot \underbrace{\log p(y \mid z_t, z_s)}_{\text{apply Bayes' rule}}
  + \log p(z_s \mid z_t) + c,
  $$
  <p>
    and apply Bayes' rule to the classifier term,
  </p>
  $$
  \log p(y \mid z_t, z_s) = \log p(z_s \mid z_t, y) - \log p(z_s \mid z_t) + c.
  $$
  <p>
    Substituting this in and absorbing the $z_s$-independent factors into the
    normalization constant leaves a simple combination of the conditional and
    unconditional reverse models:
  </p>
  $$
  \underbrace{\log p^{(\gamma)}(z_s \mid z_t, y)}_{\text{new unnormalized distribution}}
  = \gamma\, \underbrace{\log p(z_s \mid z_t, y)}_{\text{conditional model}}
  + (1 - \gamma)\, \underbrace{\log p(z_s \mid z_t)}_{\text{unconditional model}},
  $$
  <p>
    where $\gamma > 0$ is a guidance strength parameter. This form is convenient
    because it avoids a separate classifier and, as before, is tractable to normalize:
    for each token we only sum over its $N$ possible values. In practice, the
    conditional $p(z_s \mid z_t, y)$ and unconditional $p(z_s \mid z_t)$ distributions
    are parameterized by the <em>same</em> model, trained by randomly dropping the
    conditioning signal $y$ so that the network learns both modes at once
    <d-cite key="schiff2024discreteguidance"></d-cite>.
  </p>
</details>


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

<h3 id="is-diffusion-a-path-towards-more-intelligent-models-a-scaling-law-perspective">Is Diffusion A Path Towards More Intelligent Models? A Scaling-Law Perspective</h3>
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

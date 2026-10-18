CSO.register({
  id: 'ch07', num: 7, part: 'II', kind: 'compute', span: 4, cover: 'sparse',
  coverAlt: 'A dense lattice of connections with most links dimmed and a few bright surviving paths.',
  title: 'Pruning: smaller models that actually run faster', short: 'Pruning',
  lectures: [17, 18, 19],
  summary: 'How to shrink a trained network by removing weights or whole filters: granularity, the formal objective, magnitude-, derivative-, activation- and scaling-based saliency, a practical recipe, dynamic pruning, the lottery ticket hypothesis, and why execution time falls in a staircase rather than a line.',
  sections: [
    {
      id: 'need', title: 'Why we need smaller models',
      html: String.raw`
<ul>
<li>Networks keep growing: from the 0.05B-parameter Transformer to GPT-3's 175B by 2021, with trillion-parameter models by 2026. Many are <b>over-parameterized</b>.</li>
<li>Deployment and sustained inference are expensive (think of a phone's battery).</li>
<li>Large models cannot run on <b>edge devices</b>: too slow, too much memory, too much energy.</li>
</ul>
<p>We want compressed models that run faster without losing much accuracy. One option is <b>knowledge distillation (KD)</b>: a small <i>student</i> learns from a big <i>teacher</i>. Its drawback is that you must define a completely new model and train it from scratch, and the data or compute for that may not be available. The better option here is to compress the existing model: <b>pruning</b>.</p>`
    },
    {
      id: 'granularity', title: 'What to remove: granularity',
      html: String.raw`
<p>Pruning either <b>removes edges</b> (individual weights become zero, giving a sparse weight matrix) or <b>removes nodes</b> (an entire row of the weight matrix becomes zero). For conv layers there is a ladder of granularities, shown on 2 filters × 3 channels:</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 200" width="720" height="200" role="img" aria-label="Pruning granularity from fine-grained to filter level">
  <defs>
    <g id="pk3"><rect width="16" height="16"/><rect x="17" width="16" height="16"/><rect x="34" width="16" height="16"/><rect y="17" width="16" height="16"/><rect x="17" y="17" width="16" height="16"/><rect x="34" y="17" width="16" height="16"/><rect y="34" width="16" height="16"/><rect x="17" y="34" width="16" height="16"/><rect x="34" y="34" width="16" height="16"/></g>
  </defs>
  <g class="t-sm">
    <g transform="translate(20,30)"><use href="#pk3" class="f-cs s-c w1"/><use href="#pk3" y="60" class="f-cs s-c w1"/>
      <rect x="17" y="0" width="16" height="16" class="f-panel"/><rect x="0" y="34" width="16" height="16" class="f-panel"/><rect x="34" y="17" width="16" height="16" class="f-panel"/><rect x="17" y="94" width="16" height="16" class="f-panel"/><rect x="34" y="60" width="16" height="16" class="f-panel"/></g>
    <text x="45" y="160" text-anchor="middle" class="t-b">Fine-grained</text><text x="45" y="176" text-anchor="middle" class="t-mut">single weights</text>
    <g transform="translate(170,30)"><use href="#pk3" class="f-cs s-c w1"/><use href="#pk3" y="60" class="f-cs s-c w1"/>
      <rect x="0" y="17" width="50" height="16" class="f-panel"/><rect x="0" y="94" width="50" height="16" class="f-panel"/></g>
    <text x="195" y="160" text-anchor="middle" class="t-b">Vector</text><text x="195" y="176" text-anchor="middle" class="t-mut">a row inside a kernel</text>
    <g transform="translate(320,30)"><use href="#pk3" class="f-cs s-c w1"/><use href="#pk3" y="60" class="f-cs s-c w1"/>
      <rect x="0" y="60" width="50" height="50" class="f-panel"/></g>
    <text x="345" y="160" text-anchor="middle" class="t-b">Kernel</text><text x="345" y="176" text-anchor="middle" class="t-mut">a whole H×W kernel</text>
    <g transform="translate(470,30)"><use href="#pk3" class="f-cs s-c w1"/><rect x="0" y="60" width="50" height="50" class="f-panel s-line w1"/></g>
    <text x="495" y="160" text-anchor="middle" class="t-b">Filter</text><text x="495" y="176" text-anchor="middle" class="t-mut">a whole C×H×W filter</text>
    <text x="630" y="60" text-anchor="middle" class="t-m t-b">Unstructured</text>
    <text x="630" y="140" text-anchor="middle" class="t-v t-b">Structured</text>
  </g>
  <path d="M630 70 V 124" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M20 192 H 560" class="s-mut w1" marker-end="url(#arr-mut)"/>
</svg></div>
<figcaption>Grey cells are removed. Moving right, the removed pieces get larger and more regular (one channel shown per filter for clarity).</figcaption></figure>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th></th><th>Unstructured (fine-grained)</th><th>Structured (filter level)</th></tr></thead>
<tbody>
<tr><td>Control</td><td>finer</td><td>less</td></tr>
<tr><td>Sparsity for a given accuracy</td><td>better (e.g. 90% pruned)</td><td>lower (accuracy may drop beyond ~20%)</td></tr>
<tr><td>Implementation</td><td>difficult: individual positions must be tracked in the 7-loop code</td><td>easy: just change the loop bound M to M − 2</td></tr>
</tbody></table></div>
<div class="box exam"><p>Structured pruning is generally the one that improves <b>hardware performance</b>.</p></div>`
    },
    {
      id: 'definition', title: 'The pruning problem, formally',
      html: String.raw`
<div class="formula"><span class="fl">Pruning objective</span><div class="fm">\[ \arg\min_{W_P}\; L(W_P;\, D) \quad \text{subject to} \quad \phi(W_P) \le C \]</div><span class="fn">L: loss; D: target dataset; W: original weights; W_P ⊆ W: weights left after pruning; φ(·): maps the network to a constraint such as inference time, FLOPs or memory; C: the budget.</span></div>
<p>In words: among all pruned networks that satisfy the hardware constraint, pick the one with the least loss.</p>
<p>To decide <i>which</i> parameters to remove, map each one to an importance score called its <b>saliency</b> (for example the loss of accuracy if it is removed) and remove the least salient ones. The methods below differ in how they estimate saliency.</p>`
    },
    {
      id: 'magnitude', title: 'Magnitude-based pruning',
      html: String.raw`
<p>The simplest saliency is <b>|w|</b>. For a ReLU perceptron with W = [10, −8, 0.1], Y = f(10x₀ − 8x₁ + 0.1x₂), remove the 0.1 weight. (Caveat: if x₂ is huge, that small weight could still matter.)</p>
<div class="grid2">
  <div class="tile"><h4>Element-wise</h4><p>W = [[3, −2], [1, −5]] → importance |W| = [[3, 2], [1, 5]] → keep the top two → [[3, 0], [0, −5]].</p></div>
  <div class="tile"><h4>Filter-wise (L1 norm)</h4><p>Importance of a structural set S = Σ<sub>i∈S</sub> |wᵢ|. Filter A [[10, −5], [3, 14]] scores 32; filter B [[1, −5], [3, −2]] scores 11, so <b>filter B is pruned</b> (all zeros).</p></div>
</div>
<div data-w="prune"></div>
<h3>What happens to accuracy (Han et al., NeurIPS 2015)</h3>
<p>The weight distribution of a trained network peaks near zero, so many weights can go.</p>
<div data-w="bars" data-o='{"title":"Pruning without accuracy loss","hint":"Approximate pruning ratio reached with no loss","unit":"%","max":100,"labelWidth":220,"items":[["Pruning only",50,"m","~50% (at 80%: ~4.5% loss)"],["Pruning + fine-tuning",80,"c","~80%"],["Iterative prune + fine-tune",90,"c","~90%"]]}'></div>
<p>Fine-tuning (retraining, for example the last few layers) makes the weight distribution <b>bimodal</b>: the near-zero weights are gone and the rest adapt. Repeating prune → fine-tune → prune reaches about 90%.</p>`
    },
    {
      id: 'obd', title: 'Derivative-based saliency: Optimal Brain Damage',
      html: String.raw`
<p>The ideal saliency is the error caused by removing a parameter, but removing each one and re-measuring is far too expensive. LeCun et al. instead expand the change in error with a Taylor series:</p>
<div class="formula"><span class="fl">Taylor expansion of the error change</span><div class="fm">\[ \delta E = \sum_i g_i\,\delta u_i + \tfrac12 \sum_i h_{ii}\,\delta u_i^{2} + \tfrac12 \sum_{i \ne j} h_{ij}\,\delta u_i\,\delta u_j + O(\lVert \delta U \rVert^{3}),\qquad g_i = \frac{\partial E}{\partial u_i},\; h_{ij} = \frac{\partial^2 E}{\partial u_i\,\partial u_j} \]</div></div>
<p>Three assumptions kill three terms:</p>
<div class="grid3">
  <div class="tile"><h4>Diagonal</h4><p>Deleting one parameter is independent of the others, so the <b>cross terms</b> h<sub>ij</sub> (i ≠ j) go.</p></div>
  <div class="tile"><h4>Extremal</h4><p>The network has converged, so the <b>gradient term</b> g<sub>i</sub> is zero.</p></div>
  <div class="tile"><h4>Quadratic</h4><p>The cost is nearly quadratic, so the <b>higher-order term</b> goes.</p></div>
</div>
<div class="formula"><span class="fl">OBD saliency</span><div class="fm">\[ \delta E = \tfrac12 \sum_i h_{ii}\, \delta u_i^{2} \quad\Rightarrow\quad s_i = \tfrac12\, h_{ii}\, u_i^{2} \]</div><span class="fn">Removing parameter u means δu = −u. Remove the parameters with the smallest saliency.</span></div>`
    },
    {
      id: 'apoz', title: 'Activation- and scaling-based saliency',
      html: String.raw`
<div class="grid2">
<div>
<h3>APoZ: Average Percentage of Zeros</h3>
<p>A neuron whose output is mostly zero is redundant. Count zero activations per output channel and remove the filters with the highest APoZ. In the lecture example (3 output channels, batch of 2), channels 0, 1 and 2 have 11, 12 and 14 zeros, so <b>channel 2's filter</b> is pruned. This is structured pruning.</p>
</div>
<div>
<h3>Network Slimming (Liu et al., ICCV 2017)</h3>
<p>Find redundant channels <b>while training</b>: each channel gets a trainable <b>scaling factor α</b>. Channels whose factors end up tiny (e.g. 0.001, 0.003) are removed.</p>
</div>
</div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 600 150" width="600" height="150" role="img" aria-label="Network slimming: channels with small scaling factors are removed">
  <g class="t-sm">
    <text x="60" y="20" text-anchor="middle" class="t-b">channels i</text><text x="230" y="20" text-anchor="middle" class="t-b">scaling factor α</text><text x="420" y="20" text-anchor="middle" class="t-b">kept channels</text>
    <g class="f-cs s-c w1"><rect x="40" y="30" width="40" height="18" rx="3"/><rect x="40" y="56" width="40" height="18" rx="3"/><rect x="40" y="82" width="40" height="18" rx="3"/><rect x="40" y="108" width="40" height="18" rx="3"/></g>
    <text x="230" y="44" text-anchor="middle" class="t-mono">1.17</text><text x="230" y="70" text-anchor="middle" class="t-mono t-m">0.001</text><text x="230" y="96" text-anchor="middle" class="t-mono">0.29</text><text x="230" y="122" text-anchor="middle" class="t-mono t-m">0.003</text>
    <g class="f-cs s-c w1"><rect x="400" y="30" width="40" height="18" rx="3"/><rect x="400" y="82" width="40" height="18" rx="3"/></g>
    <text x="470" y="70" class="t-m">removed</text><text x="470" y="122" class="t-m">removed</text>
  </g>
  <path d="M84 39h110M84 91h110M266 39h130M266 91h130" class="s-mut w1" marker-end="url(#arr-mut)"/>
  <path d="M84 65h110M84 117h110" class="s-m w1 dash"/>
</svg></div>
<figcaption>Illustrative values: channels whose learned α is near zero contribute little and are pruned.</figcaption></figure>
<h3>Coupled channels</h3>
<p>Skip connections (ResNet) <b>couple</b> the channels of several layers: they must be pruned together, because the add needs matching channels. Earlier algorithms simply skipped coupled channels and so gained less execution time. Two fixes use <b>grouped saliencies</b>: layer grouping with one pruning mask per group (L. Liu et al., PMLR 2021) and Data Flow Coupling, DFC (T. Narshana et al., ICLR 2023), which abstracts the end-to-end transformation and its associated layers.</p>`
    },
    {
      id: 'recipe', title: 'A recipe, and dynamic pruning',
      html: String.raw`
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 150" width="700" height="150" role="img" aria-label="Pruning recipe loop">
  <g class="t-sm">
    <rect x="10" y="55" width="110" height="40" rx="5" class="f-panel s-line w1"/><text x="65" y="80" text-anchor="middle">trained model</text>
    <rect x="150" y="55" width="120" height="40" rx="5" class="f-vs s-v w1"/><text x="210" y="73" text-anchor="middle">select pruning</text><text x="210" y="88" text-anchor="middle">granularity</text>
    <rect x="300" y="20" width="390" height="110" rx="8" class="f-none s-c w1 dash"/><text x="495" y="14" text-anchor="middle" class="t-c t-b">repeat</text>
    <rect x="315" y="55" width="110" height="40" rx="5" class="f-cs s-c w1"/><text x="370" y="73" text-anchor="middle">select params</text><text x="370" y="88" text-anchor="middle">to prune</text>
    <rect x="445" y="55" width="100" height="40" rx="5" class="f-cs s-c w1"/><text x="495" y="80" text-anchor="middle">remove them</text>
    <rect x="565" y="55" width="110" height="40" rx="5" class="f-cs s-c w1"/><text x="620" y="80" text-anchor="middle">fine-tune</text>
  </g>
  <path d="M120 75h28M270 75h43M425 75h18M545 75h18" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M620 95 C 620 125, 370 125, 370 97" class="f-none s-c w15" marker-end="url(#arr-c)"/>
</svg></div></figure>
<h3>Dynamic pruning</h3>
<p><b>Static</b> pruning removes parameters permanently. That is not recoverable, can lower capacity and accuracy for good, and ignores the current input (for example unseen classes). <b>Dynamic</b> pruning decides <b>at runtime</b> which filters, connections or layers to skip in the forward pass: an easy image (a football) gets pruned more than a complex one (a Picasso), the full network is still available, and the balance can be adjusted to the resources at hand.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 640 160" width="640" height="160" role="img" aria-label="Decision network produces a channel mask for each layer from the previous layer's feature maps">
  <g class="t-sm">
    <rect x="20" y="20" width="120" height="44" rx="5" class="f-cs s-c w1"/><text x="80" y="47" text-anchor="middle">layer i − 1</text>
    <rect x="260" y="20" width="120" height="44" rx="5" class="f-cs s-c w1"/><text x="320" y="47" text-anchor="middle">layer i</text>
    <rect x="500" y="20" width="120" height="44" rx="5" class="f-cs s-c w1"/><text x="560" y="47" text-anchor="middle">layer i + 1</text>
    <rect x="140" y="100" width="190" height="44" rx="5" class="f-vs s-v w1"/><text x="235" y="120" text-anchor="middle">decision network</text><text x="235" y="136" text-anchor="middle" class="t-mut">(e.g. RNN encoder/decoder)</text>
    <text x="350" y="96" class="t-v">binary mask per channel</text>
  </g>
  <path d="M140 42h118M380 42h118" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M100 64 L 170 98" class="s-mut w1 dash" marker-end="url(#arr-mut)"/>
  <path d="M300 100 L 315 66" class="s-v w15" marker-end="url(#arr-v)"/>
</svg></div>
<figcaption>Dynamic pruning: a CNN backbone plus a decision network that looks at layer i − 1's fmaps and emits a mask for layer i.</figcaption></figure>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th></th><th>Static</th><th>Dynamic</th></tr></thead>
<tbody>
<tr><td>When</td><td>offline, before inference</td><td>at runtime</td></tr>
<tr><td>Fine-tuning</td><td>needed</td><td>not needed</td></tr>
<tr><td>Overhead</td><td>none at runtime</td><td>may be higher (decision network)</td></tr>
<tr><td>Capacity</td><td>permanently reduced</td><td>full network preserved</td></tr>
</tbody></table></div>`
    },
    {
      id: 'lth', title: 'The lottery ticket hypothesis',
      html: String.raw`
<p>Frankle et al. (ICLR 2019) ask: can we train a <b>sparse subnetwork</b> of a dense network <b>from scratch</b> and reach the same accuracy? They find it with iterative magnitude pruning, plus one twist:</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 170" width="720" height="170" role="img" aria-label="Usual pruning versus lottery ticket hypothesis">
  <g class="t-sm">
    <text x="10" y="30" class="t-b">Usual</text>
    <rect x="80" y="12" width="90" height="30" rx="4" class="f-panel s-line w1"/><text x="125" y="32" text-anchor="middle">initial model</text>
    <rect x="200" y="12" width="90" height="30" rx="4" class="f-panel s-line w1"/><text x="245" y="32" text-anchor="middle">train</text>
    <rect x="320" y="12" width="90" height="30" rx="4" class="f-panel s-line w1"/><text x="365" y="32" text-anchor="middle">prune</text>
    <rect x="440" y="12" width="120" height="30" rx="4" class="f-panel s-line w1"/><text x="500" y="32" text-anchor="middle">retrain pruned</text>
    <text x="580" y="32" class="t-m">often can't recover</text>
    <text x="10" y="110" class="t-b">LTH</text>
    <rect x="80" y="92" width="90" height="30" rx="4" class="f-panel s-line w1"/><text x="125" y="112" text-anchor="middle">initial model</text>
    <rect x="200" y="92" width="90" height="30" rx="4" class="f-panel s-line w1"/><text x="245" y="112" text-anchor="middle">train</text>
    <rect x="320" y="92" width="90" height="30" rx="4" class="f-panel s-line w1"/><text x="365" y="112" text-anchor="middle">prune</text>
    <rect x="440" y="80" width="120" height="54" rx="4" class="f-vs s-v w15"/><text x="500" y="100" text-anchor="middle">reset survivors</text><text x="500" y="116" text-anchor="middle">to ORIGINAL init,</text><text x="500" y="130" text-anchor="middle">then retrain</text>
    <text x="580" y="112" class="t-c">similar accuracy</text><text x="580" y="128" class="t-c">("winning ticket")</text>
  </g>
  <path d="M170 27h28M290 27h28M410 27h28M170 107h28M290 107h28M410 107h28" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M125 122 C 125 165, 500 165, 500 136" class="f-none s-v w1 dash" marker-end="url(#arr-v)"/>
</svg></div>
<figcaption>The key difference is reinitializing the remaining weights to their original initial values (dashed arrow) before retraining.</figcaption></figure>`
    },
    {
      id: 'hw', title: 'Pruning meets hardware',
      html: String.raw`
<h3>Not all layers are equal</h3>
<p>Pruning one layer at a time in VGG on CIFAR-10: layer 0 loses no accuracy until about 40%, then drops sharply. Some layers are more sensitive than others; empirically, <b>deeper layers can usually be pruned more</b> than early ones.</p>
<p>So should we only prune the layers that lose little accuracy? <b>No.</b> Layers have very different execution times. Pruning cheap layers barely helps total time. Strike a balance between execution time saved and accuracy lost.</p>
<h3>The staircase</h3>
<p>You would expect execution time to fall linearly as the pruning ratio rises. Measured on ResNet-50 on an AMD 64-core server, it falls in a <b>staircase</b> for some layers (conv1, conv10) and closer to linearly for others (conv4, conv15). Hardware works in blocks (cache lines, vector widths), so removing a few channels often changes nothing until a whole block is gone.</p>
<div data-w="staircase"></div>
<div class="grid2">
  <div class="box exam" data-t="Platform-aware pruning"><p>The exact staircase differs per platform (cache sizes and so on). Prune <b>at or just after a drop</b> (points A or C); pruning inside a flat region (between A and B) costs accuracy and saves no time.</p></div>
  <div class="box insight" data-t="FLOPs are not time"><p>FLOPs must fall comparatively <b>more</b> to get a given speed-up: on a plot of normalized speed-up Δt against normalized FLOP reduction Δf, the points lie <b>below y = x</b> (Δt = 0.2 needs Δf ≈ 0.35–0.4). <b>50% pruning does not mean 2× speed-up.</b></p></div>
</div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 360 220" width="360" height="220" role="img" aria-label="Normalized speed-up versus FLOP reduction lies below y equals x">
  <line x1="40" y1="180" x2="330" y2="180" class="s-line w1"/><line x1="40" y1="180" x2="40" y2="20" class="s-line w1"/>
  <line x1="40" y1="180" x2="200" y2="20" class="s-mut w1 dash"/>
  <path d="M40 180 L 80 172 L 110 160 L 150 140 L 190 116 L 230 92 L 270 70 L 310 46" class="f-none s-m w2"/>
  <g class="f-m"><circle cx="80" cy="172" r="3"/><circle cx="110" cy="160" r="3"/><circle cx="150" cy="140" r="3"/><circle cx="190" cy="116" r="3"/><circle cx="230" cy="92" r="3"/><circle cx="270" cy="70" r="3"/></g>
  <g class="t-sm"><text x="185" y="208" text-anchor="middle" class="t-mut">Δf: normalized FLOP reduction</text><text x="14" y="100" class="t-mut" transform="rotate(-90 14 100)" text-anchor="middle">Δt: speed-up</text><text x="205" y="30" class="t-mut">y = x</text><text x="250" y="110" class="t-m">measured</text></g>
</svg></div><figcaption>Schematic of the lecture's plot: real speed-ups fall short of the FLOP savings.</figcaption></figure>`
    }
  ],
  takeaways: [
    'Pruning compresses an existing model; knowledge distillation needs a new model trained from scratch.',
    'Unstructured pruning reaches higher sparsity; structured (filter) pruning is easy to implement and actually speeds up hardware.',
    'Objective: minimize loss over pruned weights W_P subject to a hardware constraint φ(W_P) ≤ C.',
    'Saliency options: |w| (magnitude), ½·h_ii·u_i² (OBD, after diagonal, extremal and quadratic assumptions), APoZ, learned channel scaling factors.',
    'Fine-tuning and iterating raise lossless pruning from ~50% to ~80% to ~90%.',
    'Coupled channels (skip connections) must be pruned together; grouped saliencies (layer grouping, DFC) handle them.',
    'Dynamic pruning picks what to skip per input at runtime; the lottery ticket resets survivors to their original init before retraining.',
    'Execution time falls in a staircase; prune at drop points, and expect less speed-up than FLOP reduction.'
  ],
  numbers: [
    ['Lossless pruning, pruning only', '~50%', 'Han et al. 2015 (80% → ~4.5% loss)'],
    ['With fine-tuning', '~80%', 'bimodal weight distribution'],
    ['Iterative prune + fine-tune', '~90%', 'no accuracy loss'],
    ['VGG layer 0 (CIFAR-10)', 'no loss until ~40%', 'then a sharp drop'],
    ['Δt = 0.2 speed-up needs', 'Δf ≈ 0.35–0.4', 'FLOP reduction']
  ],
  quiz: [
    { q: 'Which pruning granularity is easiest to turn into real speed-up on ordinary hardware?', o: ['Fine-grained', 'Vector level', 'Kernel level', 'Filter level'], a: 3, why: 'Removing whole filters just shrinks the loop bound M.' },
    { q: 'Element-wise magnitude pruning of [[3, −2], [1, −5]] keeping 2 weights gives…', o: ['[[3, −2], [0, 0]]', '[[3, 0], [0, −5]]', '[[0, −2], [1, 0]]', '[[3, 0], [1, 0]]'], a: 1, why: 'The two largest |w| are 5 and 3.' },
    { q: 'L1 norm of filter A = [[10, −5], [3, 14]]?', num: 32, tol: 0, why: '10 + 5 + 3 + 14 = 32 (filter B scores 11 and is pruned).' },
    { q: 'Which OBD assumption removes the first-order (gradient) term?', o: ['Diagonal', 'Extremal', 'Quadratic', 'Linear'], a: 1, why: 'At convergence the gradient is zero.' },
    { q: 'The OBD saliency of parameter u_i is…', o: ['|u_i|', '½·h_ii·u_i²', 'g_i·u_i', 'h_ij·u_i·u_j'], a: 1, why: 'Only the diagonal second-order term survives.' },
    { q: 'APoZ prunes filters whose output channels have…', o: ['the largest weights', 'the most zero activations', 'the largest gradients', 'the smallest bias'], a: 1, why: 'Mostly-zero outputs mean the neuron is redundant.' },
    { q: 'Why can\'t ResNet channels joined by a skip connection be pruned independently?', o: ['They share weights', 'They are coupled through the add and must be pruned together', 'They have no saliency', 'They are always zero'], a: 1, why: 'The element-wise add needs matching channels in all coupled layers.' },
    { q: 'What distinguishes the lottery ticket procedure?', o: ['Pruning before training', 'Resetting surviving weights to their original initial values before retraining', 'Using a decision network', 'Pruning activations'], a: 1, why: 'The "winning ticket" is the sparse subnetwork with its original initialization.' },
    { q: 'Which is true of dynamic pruning?', o: ['It permanently removes weights', 'It needs heavy fine-tuning', 'It decides at runtime what to skip, per input', 'It cannot adapt to resources'], a: 2, why: 'A decision network emits masks per input; full capacity is preserved.' },
    { q: 'Pruning a layer inside a flat region of the staircase…', o: ['saves the most time', 'costs accuracy without saving time', 'improves accuracy', 'has no effect on accuracy'], a: 1, why: 'Execution time only drops at the steps.' },
    { q: 'Does 50% pruning give a 2× speed-up?', o: ['Yes, always', 'No: Δt vs Δf lies below y = x', 'Only for FC layers', 'Only with unstructured pruning'], a: 1, why: 'FLOPs must fall more than proportionally for a given speed-up.' }
  ],
  cards: [
    { f: 'Pruning vs distillation', b: 'Pruning compresses the existing model. KD trains a new student from scratch using a teacher.' },
    { f: 'Unstructured vs structured', b: 'Unstructured: better sparsity/accuracy, hard to implement. Structured: less sparsity, easy (smaller M), real speed-up.' },
    { f: 'Pruning objective', b: 'argmin L(W_P; D) s.t. φ(W_P) ≤ C, with φ = time, FLOPs or memory.' },
    { f: 'Saliency', b: 'Importance score per parameter; remove the least salient ones.' },
    { f: 'OBD assumptions', b: 'Diagonal (drop cross terms), extremal (drop gradient term), quadratic (drop higher order). s = ½ h_ii u².' },
    { f: 'APoZ', b: 'Average percentage of zeros per channel; prune filters with the highest APoZ.' },
    { f: 'Network slimming', b: 'Trainable scaling factor per channel; remove channels with tiny factors.' },
    { f: 'Lottery ticket hypothesis', b: 'Train, prune, reset survivors to original init, retrain → similar accuracy.' },
    { f: 'Staircase', b: 'Execution time drops in steps as pruning rises; prune at drop points; platform-aware.' }
  ]
});

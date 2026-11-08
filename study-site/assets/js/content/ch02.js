CSO.register({
  id: 'ch02', num: 2, part: 'I', kind: 'compute', span: 3, cover: 'fmaps',
  coverAlt: 'Feature-map slabs shrinking and deepening from left to right, with a copper filter projecting a patch onto the next layer.',
  title: 'DNNs and the convolution', short: 'DNN and CNN basics',
  lectures: [3, 4],
  summary: 'The vocabulary of deep neural networks, how training works and why gradients vanish, and then the convolution itself: filters, channels, batches and the seven shape parameters you will use for the rest of the course.',
  sections: [
    {
      id: 'vocab', title: 'DNN vocabulary',
      html: String.raw`
<p>These words come back in every later chapter, so it pays to fix them now.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 280" width="700" height="280" role="img" aria-label="A two-layer network: input neurons, synapses with weights, output neurons called activations">
  <g class="s-line w1">
    <line x1="120" y1="70" x2="330" y2="50"/><line x1="120" y1="70" x2="330" y2="120"/><line x1="120" y1="70" x2="330" y2="190"/><line x1="120" y1="70" x2="330" y2="250"/>
    <line x1="120" y1="150" x2="330" y2="50"/><line x1="120" y1="150" x2="330" y2="120"/><line x1="120" y1="150" x2="330" y2="190"/><line x1="120" y1="150" x2="330" y2="250"/>
    <line x1="120" y1="230" x2="330" y2="50"/><line x1="120" y1="230" x2="330" y2="120"/><line x1="120" y1="230" x2="330" y2="190"/><line x1="120" y1="230" x2="330" y2="250"/>
    <line x1="330" y1="50" x2="540" y2="110"/><line x1="330" y1="120" x2="540" y2="110"/><line x1="330" y1="190" x2="540" y2="190"/><line x1="330" y1="250" x2="540" y2="190"/>
  </g>
  <line x1="120" y1="150" x2="330" y2="120" class="s-m w3"/>
  <g class="f-ms s-m w15"><circle cx="120" cy="70" r="18"/><circle cx="120" cy="150" r="18"/><circle cx="120" cy="230" r="18"/></g>
  <g class="f-cs s-c w15"><circle cx="330" cy="50" r="18"/><circle cx="330" cy="120" r="18"/><circle cx="330" cy="190" r="18"/><circle cx="330" cy="250" r="18"/></g>
  <g class="f-vs s-v w15"><circle cx="540" cy="110" r="18"/><circle cx="540" cy="190" r="18"/></g>
  <g class="t-sm">
    <text x="120" y="24" text-anchor="middle" class="t-b">L1 inputs</text><text x="120" y="38" text-anchor="middle" class="t-mut">(e.g. image pixels)</text>
    <text x="330" y="16" text-anchor="middle" class="t-b">L1 outputs = activations</text>
    <text x="540" y="70" text-anchor="middle" class="t-b">L2 output activations</text>
    <text x="210" y="122" class="t-m t-b">W₂₁ (a synapse)</text>
    <text x="225" y="275" text-anchor="middle" class="t-mut">Layer 1: fully connected (3×4 = 12 weights)</text>
    <text x="435" y="275" text-anchor="middle" class="t-mut">Layer 2: sparsely connected</text>
    <text x="600" y="150" class="t-mut">Yⱼ = f(Σᵢ Wᵢⱼ Xᵢ)</text>
  </g>
</svg></div>
<figcaption>Neurons, synapses (weights) and activations. Layer 1 is fully connected; layer 2 is sparse, which is what pruning produces.</figcaption></figure>
<div class="grid2">
  <div class="tile"><h4>Neuron and synapse</h4><p>A neuron multiplies its inputs by weights and sums them. The connections are called <b>synapses</b>, each carrying a <b>weight</b>. Output \(Y_j = f\big(\sum_i W_{ij}X_i\big)\).</p></div>
  <div class="tile"><h4>Layer and activation</h4><p>A <b>layer</b> is a group of synapses. Its inputs are the previous layer's outputs; its outputs are called <b>activations</b> and become the next layer's input activations.</p></div>
  <div class="tile"><h4>Fully vs sparsely connected</h4><p>Fully connected: every input neuron links to every output neuron. Sparsely connected: some links are missing. Pruning turns dense layers into sparse ones.</p></div>
  <div class="tile"><h4>Weight sharing; feed-forward vs feedback</h4><p>Weight sharing: many synapses use the same weight value (convolution does this). Feed-forward connections go one way; feedback connections loop back (RNN, LSTM).</p></div>
</div>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Network</th><th>Connections</th></tr></thead><tbody>
<tr><td>Fully connected NN (multi-layer perceptron)</td><td>Feed-forward, fully connected</td></tr>
<tr class="hl"><td>Convolutional NN (CNN)</td><td>Feed-forward, sparsely connected, with weight sharing</td></tr>
<tr><td>Recurrent NN (RNN)</td><td>Feedback</td></tr>
<tr><td>Long short-term memory (LSTM)</td><td>Feedback plus storage (memory cells)</td></tr>
</tbody></table></div>`
    },
    {
      id: 'training', title: 'Inference, training and backpropagation',
      html: String.raw`
<p><b>Inference</b> uses trained weights to predict, for example when you paste a question into a chatbot. <b>Training</b> determines those weights. It can be supervised, semi-supervised, unsupervised or self-supervised, or reinforcement learning.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 200" width="700" height="200" role="img" aria-label="Forward pass left to right, error at the output, gradients flow backward">
  <g class="t-sm">
    <rect x="10" y="60" width="90" height="60" rx="6" class="f-panel s-line w1"/><text x="55" y="95" text-anchor="middle" class="t-b">input x</text>
    <rect x="140" y="60" width="100" height="60" rx="6" class="f-cs s-c w15"/><text x="190" y="95" text-anchor="middle" class="t-b">layer 1</text>
    <rect x="280" y="60" width="100" height="60" rx="6" class="f-cs s-c w15"/><text x="330" y="95" text-anchor="middle" class="t-b">layer 2</text>
    <rect x="420" y="60" width="100" height="60" rx="6" class="f-cs s-c w15"/><text x="470" y="95" text-anchor="middle" class="t-b">layer 3</text>
    <rect x="560" y="60" width="130" height="60" rx="6" class="f-ms s-m w15"/><text x="625" y="86" text-anchor="middle" class="t-b">error</text><text x="625" y="104" text-anchor="middle" class="t-mut">vs label</text>
  </g>
  <path d="M100 76h38M240 76h38M380 76h38M520 76h38" class="s-c w2" marker-end="url(#arr-c)"/>
  <text x="330" y="44" text-anchor="middle" class="t-sm t-c t-b">forward pass: compute and keep activations</text>
  <path d="M558 108h-36M418 108h-36M278 108h-36" class="s-m w2" marker-end="url(#arr-m)"/>
  <text x="400" y="150" text-anchor="middle" class="t-sm t-m t-b">backward pass: gradients ∂E/∂W, last layer first</text>
  <text x="400" y="170" text-anchor="middle" class="t-sm t-mut">each layer's gradient needs the activations saved in the forward pass</text>
</svg></div>
<figcaption>Training loop: random initial weights → forward pass → error against the label → backpropagate gradients → update weights. Repeat over many batches and epochs.</figcaption></figure>
<p>Two observations about backpropagation matter for hardware:</p>
<ol>
  <li><b>Partial derivatives share computations.</b> There are common terms for every neuron in a layer, so they need not be recomputed.</li>
  <li><b>Partial derivatives need the forward-pass activations.</b> Either store (cache) them during the forward pass or recompute them later.</li>
</ol>
<div class="box insight"><p>Hardware ML accelerators exploit both: repeated computations are avoided by <b>caching</b>, and identical computations are <b>reused</b>. The trade-off between storing activations and recomputing them returns in <a href="#ch10">FlashAttention</a> and in <a href="#ch18">gradient checkpointing</a>.</p></div>`
    },
    {
      id: 'vanishing', title: 'Vanishing gradients',
      html: String.raw`
<p>Instead of plain gradient descent, training uses <b>stochastic gradient descent (SGD)</b>, which updates weights after small batches and converges faster. SGD works well for a few layers. But in backpropagation, the gradient reaching layer 1 is a product of terms from every later layer, and weights are usually small:</p>
<div class="formula"><span class="fl">Ten layers, each contributing a factor of 0.5</span><div class="fm">\[ 0.5^{10} \approx 0.001 \]</div><span class="fn">The first layers barely change: the gradient has vanished.</span></div>
<p>This <b>vanishing gradient problem</b> slows or stalls training of deep networks. The fixes named in the lecture:</p>
<div class="grid3">
  <div class="tile"><h4>Residual connections</h4><p>Shortcut paths that let gradients skip layers. The heart of ResNet (<a href="#ch04">Chapter 4</a>). They add compute and storage cost.</p></div>
  <div class="tile"><h4>ReLU instead of sigmoid</h4><p>ReLU's gradient is 1 for positive inputs, while sigmoid's never exceeds 0.25 and vanishes for large |x|.</p></div>
  <div class="tile"><h4>Batch normalization</h4><p>Keeps activations in a well-behaved range from layer to layer.</p></div>
</div>`
    },
    {
      id: 'why-conv', title: 'Why convolution?',
      html: String.raw`
<p>If you feed an image to an MLP, every pixel becomes a separate input neuron. That throws away the most useful fact about images: <b>neighbouring pixels are related</b>. You recognise a face by looking at patches (an eye, an edge), not at pixels one by one.</p>
<p>A <b>convolution</b> captures neighbourhood information. A small matrix of parameters, the <b>filter</b> (or kernel), slides across the image; at each position it is multiplied element-wise with the patch underneath and the products are summed. The filter values are weights, trained by backpropagation like any other.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 760 190" width="760" height="190" role="img" aria-label="Deep CNN pipeline">
  <g class="t-sm">
    <rect x="10" y="60" width="70" height="70" rx="4" class="f-panel s-line w1"/><text x="45" y="100" text-anchor="middle" class="t-b">image</text>
    <rect x="100" y="50" width="70" height="90" rx="4" class="f-cs s-c w15"/><text x="135" y="92" text-anchor="middle" class="t-b">CONV</text><text x="135" y="110" text-anchor="middle" class="t-mut">+ act.</text>
    <rect x="185" y="60" width="56" height="70" rx="4" class="f-vs s-v w1"/><text x="213" y="100" text-anchor="middle">NORM</text>
    <rect x="256" y="60" width="56" height="70" rx="4" class="f-ms s-m w1"/><text x="284" y="100" text-anchor="middle">POOL</text>
    <rect x="330" y="50" width="70" height="90" rx="4" class="f-cs s-c w15"/><text x="365" y="92" text-anchor="middle" class="t-b">CONV</text><text x="365" y="110" text-anchor="middle" class="t-mut">+ act.</text>
    <text x="430" y="99" text-anchor="middle" class="t-b">…</text>
    <rect x="460" y="50" width="70" height="90" rx="4" class="f-cs s-c w15"/><text x="495" y="92" text-anchor="middle" class="t-b">CONV</text>
    <rect x="550" y="50" width="70" height="90" rx="4" class="f-panel s-ink w15"/><text x="585" y="92" text-anchor="middle" class="t-b">FC</text><text x="585" y="110" text-anchor="middle" class="t-mut">1–3 layers</text>
    <rect x="640" y="60" width="110" height="70" rx="4" class="f-surf s-ink w1"/><text x="695" y="92" text-anchor="middle" class="t-b">classes</text><text x="695" y="110" text-anchor="middle" class="t-mut">cat, dog, …</text>
    <text x="230" y="170" text-anchor="middle" class="t-mut">low-level features: edges, brightness</text>
    <text x="500" y="170" text-anchor="middle" class="t-mut">high-level features: eyes, nose, ears</text>
    <text x="380" y="30" text-anchor="middle" class="t-c t-b">convolution is more than 90% of all computation</text>
  </g>
  <path d="M80 95h18M170 95h13M241 95h13M312 95h16M530 95h18M620 95h18" class="s-mut w15" marker-end="url(#arr-mut)"/>
</svg></div>
<figcaption>A deep CNN. Each CONV and FC layer is followed by a non-linear activation (otherwise the layers would collapse into one); NORM and POOL layers are optional.</figcaption></figure>
<ul>
  <li>Early CONV layers find <b>low-level</b> features (edges, intensity); later ones find <b>high-level</b> features (eyes, ears).</li>
  <li><b>Fully connected</b> layers at the end turn features into class scores.</li>
  <li><b>Normalization</b> keeps activation values in range; <b>pooling</b> makes the network tolerant of small shifts (translational invariance).</li>
  <li>"How deep is deep?" The lecture's rule of thumb: more than about five layers. Modern CNNs have from 5 to more than 1,000 layers.</li>
</ul>
<div class="box exam"><p>Convolutions account for <b>more than 90%</b> of a CNN's computation, so they dominate both runtime and energy. Anything that speeds up convolution speeds up the whole network.</p></div>`
    },
    {
      id: 'conv-process', title: 'The convolution process',
      html: String.raw`
<p>Take one input feature map (fmap) of height H and width W, and one filter of height R and width S. At each position:</p>
<ol class="steps">
  <li><div>Project the filter onto an R×S patch of the input.</div></li>
  <li><div>Multiply element by element. Each product is a <b>partial sum (psum)</b>.</div></li>
  <li><div>Accumulate the partial sums into one <b>output activation</b>.</div></li>
  <li><div>Slide the filter by the <b>stride U</b>, along the row and then down to the next row. This is <b>sliding-window processing</b>.</div></li>
</ol>
<div data-w="conv" data-o='{"H":5,"R":3,"U":1}'></div>
<div class="formula"><span class="fl">Output size (no padding)</span><div class="fm">\[ E = \frac{H - R + U}{U} = \frac{H-R}{U} + 1, \qquad F = \frac{W - S + U}{U} \]</div><span class="fn">With stride 1 this is simply H − R + 1. A 12×12 input and a 5×5 filter give 8×8.</span></div>
<p><b>Stride</b> is how far the filter moves between positions. With stride 1 on a row of length 8 the filter covers columns 0–2, then 1–3, then 2–4; with stride 2 it covers 0–2, then 2–4.</p>`
    },
    {
      id: 'channels', title: 'Channels, many filters and batches',
      html: String.raw`
<p>Real images and fmaps have <b>channels</b>: a colour photo has three (red, green, blue), and deeper fmaps have hundreds. A filter therefore has as many channels as its input: it is <b>R × S × C</b>. Each channel of the filter convolves with the matching channel of the input, and the results are <b>added across channels</b> to give one output value.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 760 300" width="760" height="300" role="img" aria-label="N inputs of H by W by C convolved with M filters of R by S by C give N outputs of E by F by M">
  <g class="t-sm">
    <g transform="translate(20,40)">
      <rect x="24" y="0" width="120" height="120" class="f-ms s-m w1"/><rect x="12" y="12" width="120" height="120" class="f-ms s-m w1"/><rect x="0" y="24" width="120" height="120" class="f-surf s-m w15"/>
      <rect x="10" y="34" width="40" height="40" class="f-m" opacity="0.5"/>
      <text x="60" y="166" text-anchor="middle" class="t-b">input fmap</text><text x="60" y="184" text-anchor="middle" class="t-mut">H × W × C</text>
    </g>
    <text x="200" y="120" class="t-lg">*</text>
    <g transform="translate(230,60)">
      <rect x="16" y="0" width="54" height="54" class="f-vs s-v w1"/><rect x="8" y="8" width="54" height="54" class="f-vs s-v w1"/><rect x="0" y="16" width="54" height="54" class="f-surf s-v w15"/>
      <text x="35" y="92" text-anchor="middle" class="t-b">filter 1</text>
      <rect x="96" y="0" width="54" height="54" class="f-vs s-v w1"/><rect x="88" y="8" width="54" height="54" class="f-vs s-v w1"/><rect x="80" y="16" width="54" height="54" class="f-surf s-v w15"/>
      <text x="115" y="92" text-anchor="middle" class="t-b">filter M</text><text x="75" y="130" text-anchor="middle" class="t-mut">M filters, each R × S × C</text>
      <text x="62" y="50" class="t-mut">…</text>
    </g>
    <text x="410" y="120" class="t-lg">=</text>
    <g transform="translate(450,50)">
      <rect x="36" y="0" width="90" height="90" class="f-cs s-c w1"/><rect x="24" y="12" width="90" height="90" class="f-cs s-c w1"/><rect x="12" y="24" width="90" height="90" class="f-cs s-c w1"/><rect x="0" y="36" width="90" height="90" class="f-surf s-c w15"/>
      <rect x="8" y="44" width="14" height="14" class="f-c"/>
      <text x="60" y="152" text-anchor="middle" class="t-b">output fmap</text><text x="60" y="170" text-anchor="middle" class="t-mut">E × F × M (one channel per filter)</text>
    </g>
    <text x="380" y="270" text-anchor="middle" class="t-mut">Repeat for a batch of N inputs → N outputs. Filters are 4-D: R × S × C × M.</text>
    <text x="660" y="90" class="t-c t-b">one output value =</text><text x="660" y="108" class="t-c">Σ over R, S and C</text>
  </g>
</svg></div>
<figcaption>Channels must match between input and filter; the number of filters sets the number of output channels; the batch size sets the number of outputs.</figcaption></figure>
<p>Why many filters? Each one learns a different property of the image. Filter m produces output channel m, so <b>M filters give M output channels</b>, and that output becomes the input of the next layer. Servers also <b>batch</b> many inputs together (the way a chatbot server handles many users' prompts at once), so N input fmaps produce N output fmaps.</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Parameter</th><th>Meaning</th></tr></thead><tbody>
<tr><td><b>N</b></td><td>Batch size: number of input (and output) fmaps</td></tr>
<tr><td><b>M</b></td><td>Number of filters = number of output channels</td></tr>
<tr><td><b>C</b></td><td>Number of input fmap channels = filter channels</td></tr>
<tr><td><b>H / W</b></td><td>Input fmap height / width</td></tr>
<tr><td><b>R / S</b></td><td>Filter height / width</td></tr>
<tr><td><b>E / F</b></td><td>Output fmap height / width</td></tr>
<tr><td><b>U</b></td><td>Convolution stride</td></tr>
</tbody></table></div>
<div class="formula"><span class="fl">The convolution layer (Sze et al. notation)</span><div class="fm">\[ O[n][m][x][y] = \mathrm{Act}\!\left( B[m] + \sum_{i=0}^{R-1}\sum_{j=0}^{S-1}\sum_{k=0}^{C-1} I[n][k][Ux+i][Uy+j]\times W[m][k][i][j] \right) \]</div><span class="fn">0 ≤ n &lt; N, 0 ≤ m &lt; M, 0 ≤ x &lt; F, 0 ≤ y &lt; E. O = output fmaps, I = input fmaps, W = filter weights, B = biases. The terms Ux + i and Uy + j implement the stride.</span></div>
<div data-w="conv3d"></div>
<div class="box exam"><ul><li>Filter channels = input channels (C). Output channels = number of filters (M).</li><li>MACs for one layer = N · M · E · F · C · R · S. Weights = M · C · R · S (+ M biases).</li><li>The arithmetic is only multiply and add, but its structure (strides, channels, filters, batch) is what makes it hard to run efficiently.</li></ul></div>`
    }
  ],
  takeaways: [
    'Neurons are connected by synapses that carry weights; a layer\'s outputs are called activations.',
    'CNNs are feed-forward, sparsely connected and share weights; RNNs and LSTMs use feedback.',
    'Backpropagation needs the forward activations, so they are cached or recomputed; hardware exploits this reuse.',
    'Vanishing gradients come from multiplying many small numbers; residual connections, ReLU and batch norm help.',
    'Convolution slides a trainable filter over the input and is over 90% of a CNN\'s compute.',
    'Filters are R×S×C×M; output size E = (H − R + U)/U; M filters give M output channels.'
  ],
  numbers: [
    ['Share of CNN computation in convolutions', '> 90%', 'dominates runtime and energy'],
    ['Depth of modern CNNs', '5 to 1000+ layers', '"deep" means more than about 5'],
    ['Weights between 3 and 4 fully connected neurons', '12', 'every input links to every output']
  ],
  quiz: [
    { q: 'An input fmap has 3 channels. How many channels must each filter have?', o: ['1', '3', 'Equal to the number of filters M', 'Equal to the output height E'], a: 1, why: 'Filter channels must equal input channels so channel-by-channel products can be summed.' },
    { q: 'A layer has 64 filters. How many channels does its output fmap have?', num: 64, tol: 0, why: 'Each filter produces one output channel: M filters → M output channels.' },
    { q: 'Input 7×7, filter 3×3, stride 2, no padding. What is the output height E?', num: 3, tol: 0, why: 'E = (H − R)/U + 1 = (7 − 3)/2 + 1 = 3.' },
    { q: 'Input 12×12, filter 5×5, stride 1. What is E?', num: 8, tol: 0, why: '12 − 5 + 1 = 8.' },
    { q: 'Which network type is "feed-forward, sparsely connected with weight sharing"?', o: ['MLP', 'CNN', 'RNN', 'LSTM'], a: 1, why: 'The lecture table: FC = feed-forward (MLP), CNN = feed-forward + sparse + weight sharing, RNN = feedback, LSTM = feedback + storage.' },
    { q: 'Why is an MLP a poor fit for raw images?', o: ['It cannot learn non-linear functions', 'It treats each pixel separately and misses spatial similarity between neighbouring pixels', 'It has too few weights', 'It cannot be trained with backpropagation'], a: 1, why: 'Neighbouring pixels are related; convolution captures patches, an MLP does not.' },
    { q: 'Which is NOT one of the fixes for vanishing gradients mentioned in the lecture?', o: ['Residual connections', 'ReLU instead of sigmoid', 'Batch normalization', 'Larger learning rate on the last layer only'], a: 3, why: 'The lecture lists residual connections, ReLU and batch normalization.' },
    { q: 'During backpropagation, the partial derivatives need…', o: ['only the labels', 'the activations computed in the forward pass', 'the weights of the next batch', 'nothing from the forward pass'], a: 1, why: 'Hence the choice between caching activations and recomputing them.' },
    { q: 'How many MACs does one conv layer perform? (N = 1, M = 2, C = 3, E = F = 8, R = S = 5)', num: 9600, tol: 0, why: 'N·M·E·F·C·R·S = 1 × 2 × 8 × 8 × 3 × 5 × 5 = 9,600.' },
    { q: 'In the conv equation, what do the terms Ux + i and Uy + j encode?', o: ['The batch index', 'The stride of the sliding window', 'The bias', 'The activation function'], a: 1, why: 'U is the stride; the output position (x, y) maps to input position (Ux + i, Uy + j).' }
  ],
  cards: [
    { f: 'Activation', b: 'The output of a neuron/layer; it becomes the next layer\'s input activation.' },
    { f: 'Weight sharing', b: 'Many synapses use the same weight. Convolution shares one filter across all positions.' },
    { f: 'Seven CNN shape parameters', b: 'N batch, M filters, C channels, H/W input size, R/S filter size, E/F output size (+ U stride).' },
    { f: 'Output size formula', b: 'E = (H − R + U) / U, i.e. (H − R)/U + 1.' },
    { f: 'Filter dimensions', b: '4-D: R × S × C × M.' },
    { f: 'Vanishing gradient', b: 'Backprop multiplies many factors below 1, so early layers get tiny updates. Fixes: residual connections, ReLU, batch norm.' },
    { f: 'Two backprop observations', b: 'Partial derivatives share computations; they need forward-pass activations (cache or recompute).' },
    { f: 'Low- vs high-level features', b: 'Early conv layers: edges, brightness. Later layers: eyes, nose, ears.' }
  ]
});

CSO.register({
  id: 'ch04', num: 4, part: 'I', kind: 'compute', span: 3, cover: 'resnet',
  coverAlt: 'A tall stack of glowing layer slabs with bright skip connections arching over groups of layers.',
  title: 'Layers and the canonical CNNs', short: 'Canonical CNNs',
  lectures: [7, 8, 9, 10],
  summary: 'The remaining building blocks (non-linearities, pooling, batch normalization), the networks that made deep learning famous (LeNet, AlexNet, VGG, GoogLeNet, ResNet, DenseNet), what their weight and MAC counts mean for hardware, and two ways to cut FLOPs with separable convolutions.',
  sections: [
    {
      id: 'nonlin', title: 'Non-linear activation functions',
      html: String.raw`
<p>After every convolution or FC layer comes a non-linear function. Without it, a stack of layers would collapse into one linear map. The course lists five:</p>
<div class="grid2">
  <div class="formula"><span class="fl">Sigmoid, range (0, 1)</span><div class="fm">\[ y = \frac{1}{1+e^{-x}} \]</div></div>
  <div class="formula"><span class="fl">Hyperbolic tangent, range (−1, 1)</span><div class="fm">\[ y = \frac{e^{x}-e^{-x}}{e^{x}+e^{-x}} \]</div></div>
  <div class="formula"><span class="fl">ReLU</span><div class="fm">\[ y = \max(0, x) \]</div></div>
  <div class="formula"><span class="fl">Leaky ReLU (α small, e.g. 0.1)</span><div class="fm">\[ y = \max(\alpha x, x) \]</div></div>
</div>
<div class="formula"><span class="fl">Exponential linear unit (ELU)</span><div class="fm">\[ y = \begin{cases} x & x \ge 0 \\ \alpha\,(e^{x}-1) & x < 0 \end{cases} \]</div></div>
<div data-w="activations"></div>
<p>Sigmoid and tanh were the traditional choices (LeNet used sigmoid). Modern CNNs such as AlexNet, VGG and ResNet use <b>ReLU</b>: it is trivially cheap in hardware (a comparison with zero) and does not saturate for positive inputs.</p>`
    },
    {
      id: 'pooling', title: 'Pooling',
      html: String.raw`
<p>A pooling layer <b>reduces the resolution of each channel independently</b>. You choose only a window size and a stride; there are <b>no weights</b>. With stride equal to the window the windows do not overlap; with a smaller stride they do.</p>
<div data-w="pooling"></div>
<p>Pooling gives two useful properties:</p>
<div class="grid2">
  <div class="tile"><h4>Translational invariance</h4><p>Shift the letter C in a 7×7 image down by one row. The convolution outputs move too, but after 2×2 max pooling with stride 2 the pooled fmaps look nearly the same, so the network gives the same class. Pooling "provides the same output independent of the location of the object within the image".</p></div>
  <div class="tile"><h4>Noise resilience</h4><p>Noise pixels usually have lower intensity than the real feature. Max pooling keeps the strongest value in each window, so weak noise is suppressed.</p></div>
</div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 170" width="700" height="170" role="img" aria-label="A letter C and a shifted letter C both give similar fmaps after max pooling">
  <g id="c4grid">
    <rect x="10" y="20" width="126" height="126" class="f-surf s-line w1"/>
  </g>
  <g class="f-ms s-m w1">
    <rect x="46" y="38" width="18" height="18"/><rect x="64" y="38" width="18" height="18"/><rect x="82" y="38" width="18" height="18"/>
    <rect x="28" y="56" width="18" height="18"/><rect x="28" y="74" width="18" height="18"/><rect x="28" y="92" width="18" height="18"/>
    <rect x="46" y="110" width="18" height="18"/><rect x="64" y="110" width="18" height="18"/><rect x="82" y="110" width="18" height="18"/>
  </g>
  <text x="73" y="164" text-anchor="middle" class="t-sm t-mut">case 1</text>
  <rect x="160" y="20" width="126" height="126" class="f-surf s-line w1"/>
  <g class="f-ms s-m w1">
    <rect x="196" y="56" width="18" height="18"/><rect x="214" y="56" width="18" height="18"/><rect x="232" y="56" width="18" height="18"/>
    <rect x="178" y="74" width="18" height="18"/><rect x="178" y="92" width="18" height="18"/><rect x="178" y="110" width="18" height="18"/>
    <rect x="196" y="128" width="18" height="18"/><rect x="214" y="128" width="18" height="18"/><rect x="232" y="128" width="18" height="18"/>
  </g>
  <text x="223" y="164" text-anchor="middle" class="t-sm t-mut">case 2: shifted one row down</text>
  <path d="M300 83h70" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <text x="335" y="72" text-anchor="middle" class="t-sm">conv</text><text x="335" y="104" text-anchor="middle" class="t-sm">then 2×2 max pool</text>
  <g class="f-cs s-c w1"><rect x="390" y="50" width="30" height="30"/><rect x="422" y="50" width="30" height="30"/><rect x="390" y="82" width="30" height="30"/><rect x="422" y="82" width="30" height="30"/></g>
  <g class="f-cs s-c w1"><rect x="490" y="50" width="30" height="30"/><rect x="522" y="50" width="30" height="30"/><rect x="490" y="82" width="30" height="30"/><rect x="522" y="82" width="30" height="30"/></g>
  <text x="421" y="134" text-anchor="middle" class="t-sm t-mut">case 1</text><text x="521" y="134" text-anchor="middle" class="t-sm t-mut">case 2</text>
  <text x="600" y="78" class="t-sm t-b">similar fmaps</text><text x="600" y="96" class="t-sm t-mut">→ same class</text>
</svg></div>
<figcaption>The lecture's translational-invariance example (schematic): different conv outputs, similar pooled outputs.</figcaption></figure>`
    },
    {
      id: 'bn', title: 'Batch normalization and the full CNN',
      html: String.raw`
<p><b>Batch normalization (BN)</b> shifts and scales activations towards <b>mean 0 and standard deviation 1</b>, using statistics of the training data. It sits <b>between the conv/FC layer and the activation function</b>, and is believed to be a key factor in reaching high accuracy and training faster.</p>
<div class="formula"><span class="fl">Batch normalization</span><div class="fm">\[ y = \gamma\,\frac{x-\mu}{\sqrt{\sigma^{2}+\epsilon}} + \beta \]</div><span class="fn">μ, σ²: batch mean and variance. ε: small constant that avoids dividing by (almost) zero. γ, β: scale and shift learned during training.</span></div>
<p>Stitch everything together and you have a deep CNN:</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 120" width="720" height="120" role="img" aria-label="CNN pipeline: conv, BN, activation, pool repeated, then FC layers, class scores and probabilities">
  <g class="t-sm">
    <rect x="6" y="40" width="70" height="40" rx="4" class="f-panel s-line w1"/><text x="41" y="64" text-anchor="middle">image</text>
    <rect x="96" y="30" width="250" height="60" rx="6" class="f-none s-c w1 dash"/>
    <rect x="104" y="40" width="54" height="40" rx="4" class="f-cs s-c w1"/><text x="131" y="64" text-anchor="middle">CONV</text>
    <rect x="166" y="40" width="40" height="40" rx="4" class="f-panel s-line w1"/><text x="186" y="64" text-anchor="middle">BN</text>
    <rect x="214" y="40" width="60" height="40" rx="4" class="f-cs s-c w1"/><text x="244" y="64" text-anchor="middle">non-lin</text>
    <rect x="282" y="40" width="56" height="40" rx="4" class="f-ms s-m w1"/><text x="310" y="64" text-anchor="middle">POOL</text>
    <text x="221" y="22" text-anchor="middle" class="t-mut">repeated many times</text>
    <rect x="370" y="40" width="80" height="40" rx="4" class="f-vs s-v w1"/><text x="410" y="64" text-anchor="middle">FC layers</text>
    <rect x="474" y="40" width="96" height="40" rx="4" class="f-panel s-line w1"/><text x="522" y="64" text-anchor="middle">class scores</text>
    <rect x="594" y="40" width="110" height="40" rx="4" class="f-panel s-line w1"/><text x="649" y="58" text-anchor="middle">probabilities</text><text x="649" y="73" text-anchor="middle" class="t-mut">highest = label</text>
  </g>
  <path d="M76 60h18M346 60h22M450 60h22M570 60h22" class="s-mut w15" marker-end="url(#arr-mut)"/>
</svg></div></figure>`
    },
    {
      id: 'datasets', title: 'Datasets and how accuracy is reported',
      html: String.raw`
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th></th><th>MNIST</th><th>ImageNet (ILSVRC)</th></tr></thead>
<tbody>
<tr><td>Task</td><td>handwritten digit classification</td><td>object classification</td></tr>
<tr><td>Image</td><td>28×28, black and white</td><td>256×256, colour</td></tr>
<tr><td>Classes</td><td>10</td><td>1000</td></tr>
<tr><td>Training images</td><td>60,000</td><td>1.3 million</td></tr>
<tr><td>Test images</td><td>10,000</td><td>100,000</td></tr>
</tbody></table></div>
<p>ILSVRC (ImageNet Large Scale Visual Recognition Challenge) reports <b>top-K error</b>. A prediction counts as correct if the true label is among the K classes with the highest probability. If 90,000 of 100,000 test images have the right label as the single top guess, the top-1 error is 10%. Because top-5 accepts more answers, <b>top-5 error ≤ top-1 error</b>.</p>`
    },
    {
      id: 'early', title: 'LeNet-5, AlexNet and VGG',
      html: String.raw`
<div class="grid3">
  <div class="tile"><h4>LeNet-5 (AT&amp;T)</h4><p>Handwritten digits. 2 conv + 2 FC layers, <b>60k weights, 341k MACs</b>, sigmoid. 32×32 input → six 5×5 filters → 2×2 average pooling → sixteen 5×5 filters → 2×2 average pooling → FC → FC → 10 outputs.</p></div>
  <div class="tile"><h4>AlexNet (2012)</h4><p>ILSVRC'12 winner. 5 conv + 3 FC layers, <b>61M weights, 724M MACs</b>, ReLU, local response normalization. About 1000× the weights of LeNet.</p></div>
  <div class="tile"><h4>VGG-16 (2015)</h4><p>13 conv + 3 FC = 16 layers, <b>138M weights, 15.5G MACs</b>. VGG-19 also exists. More layers, deeper network.</p></div>
</div>
<h3>AlexNet layer by layer</h3>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Layer</th><th>Filter R×S</th><th>Filters M</th><th>Channels C</th><th>Stride</th><th>Weights</th></tr></thead>
<tbody>
<tr><td>CONV1</td><td>11×11</td><td>96</td><td>3</td><td>4</td><td>34k</td></tr>
<tr><td>CONV2</td><td>5×5</td><td>256</td><td>48</td><td>1</td><td>307k</td></tr>
<tr><td>CONV3</td><td>3×3</td><td>384</td><td>256</td><td>1</td><td>885k</td></tr>
<tr><td>CONV4</td><td>3×3</td><td>384</td><td>192</td><td>1</td><td>664k</td></tr>
<tr><td>CONV5</td><td>3×3</td><td>256</td><td>192</td><td>1</td><td>442k</td></tr>
<tr><td>FC6</td><td colspan="4">4096 outputs from 13×13×256</td><td>37.7M</td></tr>
<tr><td>FC7</td><td colspan="4">4096 outputs</td><td>16.8M</td></tr>
<tr><td>FC8</td><td colspan="4">1000 outputs</td><td>4.1M</td></tr>
</tbody></table></div>
<p>CONV1 has 34k weights but 105M MACs; CONV2 307k weights and 224M MACs; CONV3 885k weights and 150M MACs.</p>
<div class="box exam" data-t="The pattern to remember"><p><b>FC layers hold most of the weights; conv layers do most of the MACs.</b> Shapes vary a lot from layer to layer, so hardware must handle many shapes. More weights mean more memory transfer; more MACs mean more latency.</p></div>
<h3>Stacked small filters (VGG)</h3>
<p>Deeper networks need more weights. VGG's answer: replace one large filter with a <b>stack of 3×3 filters</b> that covers the same receptive field. Two stacked 3×3 filters (stride 1) see a 5×5 patch with <b>18 weights instead of 25</b>, and a non-linearity sits between them. Fewer weights to fetch improves hardware efficiency, at the cost of more layers.</p>
<div data-w="stacked"></div>`
    },
    {
      id: 'deeper', title: 'Going deeper: GoogLeNet and ResNet',
      html: String.raw`
<div data-w="bars" data-o='{"title":"ILSVRC top-5 error by year","hint":"Lower is better; network depth in brackets","unit":"%","labelWidth":190,"items":[["2010 shallow",28.2,"m","28.2%"],["2011 shallow",25.8,"m","25.8%"],["2012 AlexNet (8)",16.4,"c","16.4%"],["2013 ZFNet (8)",11.7,"c","11.7%"],["2014 VGG (19)",7.3,"c","7.3%"],["2014 GoogLeNet (22)",6.7,"c","6.7%"],["2015 ResNet (152)",3.57,"c","3.57%"],["Human level",5.1,"v","about 5.1%"]],"note":"Deeper networks kept lowering the error until ResNet beat the human-level estimate."}'></div>
<h3>GoogLeNet / Inception (2014)</h3>
<p>57 conv layers (depth 21), 1 FC layer, <b>7M weights, 1.43G MACs</b>: far fewer than VGG with lower error. Versions V2, V3 and V4 followed. Three ideas:</p>
<ol>
<li><b>1×1 convolutions reduce channel depth.</b> A 56×56×64 input convolved with one 1×1×64 filter gives 56×56×1; with 32 such filters, 56×56×32. A 1×1 filter has no spatial extent: it only sums across channels.</li>
<li><b>Bottleneck before big filters.</b> Putting a 1×1 layer in front of each 3×3 and 5×5 convolution cuts the multiplications in the lecture example from <b>854M to 358M</b>, small enough to train the whole DNN on one GPU.</li>
<li><b>Parallel filters of different sizes</b> (1×1, 3×3, 5×5 conv and 3×3 max pool) are concatenated, so the image is processed at several scales at once.</li>
</ol>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 640 250" width="640" height="250" role="img" aria-label="Inception module with four parallel branches concatenated">
  <g class="t-sm">
    <rect x="240" y="6" width="160" height="32" rx="4" class="f-panel s-line w1"/><text x="320" y="27" text-anchor="middle">previous layer</text>
    <rect x="20" y="150" width="120" height="32" rx="4" class="f-cs s-c w1"/><text x="80" y="171" text-anchor="middle">1×1 conv</text>
    <rect x="180" y="90" width="120" height="32" rx="4" class="f-vs s-v w1"/><text x="240" y="111" text-anchor="middle">1×1 conv</text>
    <rect x="180" y="150" width="120" height="32" rx="4" class="f-cs s-c w1"/><text x="240" y="171" text-anchor="middle">3×3 conv</text>
    <rect x="340" y="90" width="120" height="32" rx="4" class="f-vs s-v w1"/><text x="400" y="111" text-anchor="middle">1×1 conv</text>
    <rect x="340" y="150" width="120" height="32" rx="4" class="f-cs s-c w1"/><text x="400" y="171" text-anchor="middle">5×5 conv</text>
    <rect x="500" y="90" width="120" height="32" rx="4" class="f-ms s-m w1"/><text x="560" y="111" text-anchor="middle">3×3 max pool</text>
    <rect x="500" y="150" width="120" height="32" rx="4" class="f-vs s-v w1"/><text x="560" y="171" text-anchor="middle">1×1 conv</text>
    <rect x="220" y="212" width="200" height="32" rx="4" class="f-panel s-line w1"/><text x="320" y="233" text-anchor="middle">filter concatenation</text>
    <text x="410" y="80" class="t-mut">violet = 1×1 bottleneck</text>
  </g>
  <path d="M300 38 L 80 148 M310 38 L 240 88 M330 38 L 400 88 M340 38 L 560 88 M240 122v26 M400 122v26 M560 122v26 M80 182 L 250 210 M240 182 L 300 210 M400 182 L 340 210 M560 182 L 390 210" class="s-mut w1" marker-end="url(#arr-mut)"/>
</svg></div>
<figcaption>An Inception module: four branches at different scales, with 1×1 bottlenecks in front of the expensive filters.</figcaption></figure>
<p>GoogLeNet also adds <b>auxiliary classifiers</b> in the middle of the network during training (not inference). The total loss is \(\alpha \cdot \text{real loss} + (1-\alpha)\cdot \text{auxiliary loss}\), which injects gradient into the middle layers and fights the vanishing gradient problem.</p>
<h3>ResNet (2016)</h3>
<p>Simply stacking more layers makes a plain network <b>worse</b>: training and validation error both go up (vanishing gradient). In the lecture's plot, a plain 34-layer net has above 30% error, while the same depth with shortcuts reaches about 25%.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 640 170" width="640" height="170" role="img" aria-label="Residual block: two 3 by 3 convs with ReLU, plus a skip connection adding x to F(x)">
  <g class="t-sm">
    <text x="30" y="90" class="t-lg t-b">x</text>
    <rect x="80" y="66" width="100" height="36" rx="4" class="f-cs s-c w1"/><text x="130" y="89" text-anchor="middle">3×3 conv</text>
    <rect x="210" y="66" width="70" height="36" rx="4" class="f-panel s-line w1"/><text x="245" y="89" text-anchor="middle">ReLU</text>
    <rect x="310" y="66" width="100" height="36" rx="4" class="f-cs s-c w1"/><text x="360" y="89" text-anchor="middle">3×3 conv</text>
    <text x="440" y="80" class="t-mut">F(x)</text>
    <circle cx="490" cy="84" r="16" class="f-ms s-m w15"/><text x="490" y="89" text-anchor="middle" class="t-lg">+</text>
    <rect x="530" y="66" width="70" height="36" rx="4" class="f-panel s-line w1"/><text x="565" y="89" text-anchor="middle">ReLU</text>
    <text x="300" y="22" text-anchor="middle" class="t-m t-b">identity shortcut: x is kept until the add</text>
    <text x="320" y="150" text-anchor="middle" class="t-mut">output = ReLU(F(x) + x); the layers only learn the residual F(x) = H(x) − x</text>
  </g>
  <path d="M48 84h30M180 84h28M280 84h28M410 84h62M506 84h22" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M55 84 C 55 30, 490 30, 490 66" class="f-none s-m w2" marker-end="url(#arr-m)"/>
</svg></div>
<figcaption>The shortcut (residual) module. Gradients can flow straight through the skip connection.</figcaption></figure>
<ul>
<li><b>ResNet-34</b>: 16 shortcut modules × 2 conv layers + the first conv + the final FC = 34 layers.</li>
<li><b>Bottleneck</b> modules use 1×1 → 3×3 → 1×1 filters to cut computation and size, which lets the network go deeper: 16 × 3 + 1 + 1 = <b>ResNet-50</b> (49 conv, 1 FC, 25.5M weights, 3.9G MACs). Versions with 152 and 1202 layers exist.</li>
</ul>
<div class="box exam" data-t="System implication of shortcuts"><p>The input X must be <b>stored until the addition</b>. Activations are large, so X probably goes to DRAM: extra write latency and energy now, and extra read latency and energy later.</p></div>`
    },
    {
      id: 'summary', title: 'The popular DNNs side by side',
      html: String.raw`
<div class="tbl-wrap wide"><table class="tbl">
<thead><tr><th>Metric</th><th>LeNet-5</th><th>AlexNet</th><th>VGG-16</th><th>GoogLeNet v1</th><th>ResNet-50</th></tr></thead>
<tbody>
<tr><td>Top-5 error (%)</td><td>n/a</td><td>16.4</td><td>7.4</td><td>6.7</td><td>5.3</td></tr>
<tr><td>Input size</td><td>28×28</td><td>227×227</td><td>224×224</td><td>224×224</td><td>224×224</td></tr>
<tr><td># CONV layers</td><td>2</td><td>5</td><td>16</td><td>21 (depth)</td><td>49</td></tr>
<tr><td>Filter sizes</td><td>5</td><td>3, 5, 11</td><td>3</td><td>1, 3, 5, 7</td><td>1, 3, 7</td></tr>
<tr><td># channels</td><td>1, 6</td><td>3–256</td><td>3–512</td><td>3–1024</td><td>3–2048</td></tr>
<tr><td># filters</td><td>6, 16</td><td>96–384</td><td>64–512</td><td>64–384</td><td>64–2048</td></tr>
<tr><td>Stride</td><td>1</td><td>1, 4</td><td>1</td><td>1, 2</td><td>1, 2</td></tr>
<tr><td>CONV weights</td><td>2.6k</td><td>2.3M</td><td>14.7M</td><td>6.0M</td><td>23.5M</td></tr>
<tr><td>CONV MACs</td><td>283k</td><td>666M</td><td>15.3G</td><td>1.43G</td><td>3.86G</td></tr>
<tr><td># FC layers</td><td>2</td><td>3</td><td>3</td><td>1</td><td>1</td></tr>
<tr><td>FC weights</td><td>58k</td><td>58.6M</td><td>124M</td><td>1M</td><td>2M</td></tr>
<tr><td>FC MACs</td><td>58k</td><td>58.6M</td><td>124M</td><td>1M</td><td>2M</td></tr>
<tr><td><b>Total weights</b></td><td>60k</td><td>61M</td><td>138M</td><td>7M</td><td>25.5M</td></tr>
<tr><td><b>Total MACs</b></td><td>341k</td><td>724M</td><td>15.5G</td><td>1.43G</td><td>3.9G</td></tr>
</tbody></table></div>
<div class="grid2">
  <div class="box insight"><p><b>FC weights = FC MACs</b>: each FC weight is used exactly once per input. And thanks to 1×1 convolutions, GoogLeNet and ResNet are far cheaper than VGG while being more accurate.</p></div>
  <div class="box exam"><p>The same DNN can take <b>1 s or 10 ms</b> depending on how its computation is executed. That gap is what system optimization is about.</p></div>
</div>
<h3>DenseNet (2017)</h3>
<p>DenseNet adds <b>more skip connections</b>: each layer receives fmaps not only from the previous layer but from many earlier layers, strengthening feature propagation and feature reuse. Unlike ResNet, fmaps are <b>concatenated, not added</b>. The network is split into <b>dense blocks</b> separated by transition layers (conv and pool) to limit depth and therefore the size of the combined fmaps. It reaches higher accuracy than ResNet with fewer weights and fewer multiplications (DenseNet-201 beats ResNet-34/50 at the same parameter or FLOP budget).</p>`
    },
    {
      id: 'flops', title: 'Cutting FLOPs with separable convolutions',
      html: String.raw`
<p>Careful with the words: <b>FLOPS</b> is floating-point operations per second (a speed); <b>FLOPs</b> is a count of floating-point operations (work).</p>
<h3>1. Spatial separable convolution</h3>
<p>Some kernels factor into a column times a row:</p>
<div class="formula"><span class="fl">Spatially separable kernel</span><div class="fm">\[ \begin{bmatrix} 3 & 6 & 9\\ 4 & 8 & 12\\ 5 & 10 & 15 \end{bmatrix} = \begin{bmatrix} 3\\ 4\\ 5 \end{bmatrix} \times \begin{bmatrix} 1 & 2 & 3 \end{bmatrix} \]</div><span class="fn">Convolve with the 3×1 kernel, then the 1×3 kernel: same output, 6 multiplications per output instead of 9.</span></div>
<div class="box exam" data-t="Why it is rarely used"><p>Filters are <b>learned</b>, so we have no prior knowledge of them and cannot always decompose them. Forcing separability would need constraints during training, and nobody knows how to impose them well.</p></div>
<h3>2. Depth-wise separable convolution</h3>
<p>This one is practical: only the <b>filter sizes</b> change, and the network is trained that way. The lecture example: a 12×12×3 input and 256 kernels of 5×5×3 (stride 1) give an 8×8×256 output (12 − 5 + 1 = 8).</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 150" width="700" height="150" role="img" aria-label="Depth-wise then point-wise convolution">
  <g class="t-sm">
    <rect x="10" y="40" width="80" height="80" class="f-ms s-m w1"/><rect x="18" y="32" width="80" height="80" class="f-ms s-m w1"/><rect x="26" y="24" width="80" height="80" class="f-ms s-m w1"/>
    <text x="60" y="140" text-anchor="middle">12×12×3</text>
    <text x="185" y="56" text-anchor="middle" class="t-b">step 1: depth-wise</text><text x="185" y="74" text-anchor="middle" class="t-mut">three 5×5×1 filters,</text><text x="185" y="90" text-anchor="middle" class="t-mut">one per channel, no sum</text>
    <rect x="270" y="52" width="56" height="56" class="f-cs s-c w1"/><rect x="276" y="46" width="56" height="56" class="f-cs s-c w1"/><rect x="282" y="40" width="56" height="56" class="f-cs s-c w1"/>
    <text x="305" y="140" text-anchor="middle">8×8×3</text>
    <text x="440" y="56" text-anchor="middle" class="t-b">step 2: point-wise</text><text x="440" y="74" text-anchor="middle" class="t-mut">256 filters of 1×1×3</text><text x="440" y="90" text-anchor="middle" class="t-mut">mix the channels</text>
    <g class="f-vs s-v w1"><rect x="540" y="64" width="56" height="56"/><rect x="552" y="52" width="56" height="56"/><rect x="564" y="40" width="56" height="56"/><rect x="576" y="28" width="56" height="56"/></g>
    <text x="590" y="140" text-anchor="middle">8×8×256</text>
  </g>
  <path d="M112 80h40M228 80h36M350 80h36M496 80h36" class="s-mut w15" marker-end="url(#arr-mut)"/>
</svg></div></figure>
<div class="formula"><span class="fl">Multiplications, regular vs depth-wise separable</span><div class="fm">\[ \underbrace{256 \times (5\cdot5\cdot3) \times (8\cdot8)}_{\text{regular}} = 1{,}228{,}800 \qquad \underbrace{3 \times (5\cdot5) \times (8\cdot8)}_{\text{depth-wise}=4{,}800} + \underbrace{256 \times (1\cdot1\cdot3) \times (8\cdot8)}_{\text{point-wise}=49{,}152} = 53{,}952 \]</div><span class="fn">About 23× fewer multiplications.</span></div>
<p>Intuition: regular convolution transforms the 12×12 image <b>256 times</b> (each transform costs 5×5×3×8×8 = 4,800 multiplications). Depth-wise separable convolution transforms the image <b>once</b> and then uses the cheap 1×1 kernel to make 256 outputs.</p>
<div data-w="sepconv"></div>`
    }
  ],
  takeaways: [
    'Activations: sigmoid (0..1), tanh (−1..1), ReLU max(0,x), leaky ReLU max(αx,x), ELU. ReLU is cheap and does not saturate for x > 0.',
    'Pooling has no weights; it downsamples each channel and gives translational invariance and noise resilience.',
    'BN: y = γ(x − μ)/√(σ² + ε) + β, placed between conv/FC and activation; γ and β are learned.',
    'FC layers hold most weights, conv layers do most MACs; layer shapes vary widely.',
    'Stacked 3×3 filters (VGG), 1×1 bottlenecks (GoogLeNet, ResNet) and shortcuts let networks grow deeper with fewer weights.',
    'ResNet shortcuts force X to be stored (likely in DRAM) until the add: extra memory traffic.',
    'Depth-wise separable convolution cuts the example layer from 1,228,800 to 53,952 multiplications.'
  ],
  numbers: [
    ['LeNet-5', '60k weights, 341k MACs', '2 conv + 2 FC, sigmoid'],
    ['AlexNet', '61M weights, 724M MACs', '5 conv + 3 FC, ReLU, top-5 16.4%'],
    ['VGG-16', '138M weights, 15.5G MACs', '13 conv + 3 FC, top-5 7.4%'],
    ['GoogLeNet v1', '7M weights, 1.43G MACs', 'top-5 6.7%'],
    ['ResNet-50', '25.5M weights, 3.9G MACs', '49 conv + 1 FC, top-5 5.3%'],
    ['ResNet (152 layers), ILSVRC 2015', '3.57% top-5', 'human level about 5.1%'],
    ['MNIST', '28×28, 10 classes', '60k train / 10k test'],
    ['ImageNet', '1000 classes, 1.3M train', '100k test images'],
    ['GoogLeNet bottleneck', '854M → 358M mults', 'lecture example'],
    ['Depth-wise separable example', '1,228,800 → 53,952 mults', '12×12×3 input, 256 filters 5×5']
  ],
  quiz: [
    { q: 'Max pooling (2×2, stride 2) of [[23,7,7,8],[10,1,9,0],[4,4,11,6],[2,5,12,7]] gives…', o: ['[[23,9],[5,12]]', '[[10,6],[4,9]]', '[[23,8],[4,12]]', '[[41,24],[15,36]]'], a: 0, why: 'Take the maximum of each non-overlapping 2×2 window.' },
    { q: 'Where does batch normalization sit in a CNN layer?', o: ['Before the convolution', 'Between the conv/FC layer and the activation', 'After pooling only', 'Only at the output'], a: 1, why: 'BN normalizes the conv/FC outputs before the non-linearity.' },
    { q: 'In BN, which parameters are learned during training?', o: ['μ and σ²', 'γ and β', 'ε only', 'None'], a: 1, why: 'γ (scale) and β (shift) are learned; μ and σ² are batch statistics; ε is a small constant.' },
    { q: 'Which statement about AlexNet is true?', o: ['Conv layers hold most weights', 'FC layers hold most weights while conv layers do most MACs', 'It uses sigmoid', 'It has 138M weights'], a: 1, why: 'FC6 alone has 37.7M of the 61M weights; conv layers dominate the 724M MACs.' },
    { q: 'How many weights do two stacked 3×3 filters (one channel) need to cover a 5×5 receptive field?', num: 18, tol: 0, why: '2 × 9 = 18, versus 25 for a single 5×5 filter.' },
    { q: 'What does a 1×1 convolution with 32 filters do to a 56×56×64 input?', o: ['Produces 54×54×32', 'Produces 56×56×32', 'Produces 56×56×64', 'Produces 1×1×32'], a: 1, why: 'Spatial size is unchanged; the channel depth becomes the number of filters.' },
    { q: 'Why does GoogLeNet use auxiliary classifiers?', o: ['To speed up inference', 'To inject gradient into middle layers during training', 'To reduce weights', 'To replace pooling'], a: 1, why: 'Total loss = α·real + (1 − α)·auxiliary; they are used only in training.' },
    { q: 'What is the system cost of a ResNet shortcut?', o: ['Extra MACs', 'X must be stored (likely in DRAM) until the add', 'It doubles the weights', 'It prevents batching'], a: 1, why: 'Large activations kept for the add cost extra write and read energy and latency.' },
    { q: 'How does DenseNet combine fmaps from earlier layers?', o: ['Adds them', 'Concatenates them', 'Multiplies them', 'Averages them'], a: 1, why: 'ResNet adds; DenseNet concatenates and uses dense blocks to bound the size.' },
    { q: 'Total multiplications of the depth-wise separable version of the 12×12×3, 256 × 5×5×3 example?', num: 53952, tol: 0, why: 'Depth-wise 3·25·64 = 4,800 plus point-wise 256·3·64 = 49,152.' },
    { q: 'Top-5 error is always…', o: ['greater than or equal to top-1 error', 'less than or equal to top-1 error', 'equal to top-1 error', 'unrelated to top-1 error'], a: 1, why: 'Top-5 accepts more answers as correct, so its error cannot be larger.' }
  ],
  cards: [
    { f: 'ReLU vs sigmoid', b: 'ReLU = max(0, x): cheap and keeps gradient 1 for x > 0. Sigmoid saturates, so gradients vanish.' },
    { f: 'Pooling', b: 'Downsamples each channel independently, no weights. Gives translational invariance and noise resilience.' },
    { f: 'Batch normalization', b: 'y = γ(x − μ)/√(σ² + ε) + β; between conv/FC and activation; γ, β learned.' },
    { f: 'Top-K error', b: 'Correct if the true label is among the K most probable classes. Top-5 ≤ top-1.' },
    { f: 'FC vs conv in AlexNet', b: 'FC layers: most weights (memory). Conv layers: most MACs (latency).' },
    { f: '1×1 bottleneck', b: 'Reduces channel depth before 3×3/5×5 filters; GoogLeNet example 854M → 358M mults.' },
    { f: 'Residual block', b: 'Output = ReLU(F(x) + x). Learns F(x) = H(x) − x. X must be stored until the add.' },
    { f: 'Depth-wise separable conv', b: 'Per-channel K×K conv then 1×1×C point-wise conv. Ratio ≈ 1/M + 1/K² of regular cost.' },
    { f: 'DenseNet', b: 'Skip connections from many earlier layers; concatenates fmaps; dense blocks bound the size.' }
  ]
});

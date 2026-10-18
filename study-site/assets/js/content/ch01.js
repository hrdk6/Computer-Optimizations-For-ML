CSO.register({
  id: 'ch01', num: 1, part: 'I', kind: 'memory', span: 3, cover: 'memory',
  coverAlt: 'A small compute die surrounded by tall stacks of memory, joined by thin copper links.',
  title: 'Why computer systems for ML', short: 'Why systems for ML',
  lectures: [1, 2],
  summary: 'Why machine learning took off, why it needs ever faster computers, and the chain of bottlenecks (memory, communication, area) that the rest of the course attacks one by one.',
  sections: [
    {
      id: 'course', title: 'What this course is about',
      html: String.raw`
<p class="lede">Every topic in this course follows the same two steps. First we learn how an ML algorithm works: a CNN, an LLM, a graph neural network. Then we ask how a computer system should run that algorithm so that it finishes with lower <span class="k-compute">latency</span> and lower <span class="k-memory">energy</span>.</p>
<p>The lectures start with <b>inference</b> (using trained weights to make a prediction) and then move to <b>training</b> (finding the weights), which is far more compute-hungry. The original plan, shown on the first slide, was twenty 90-minute lectures; NPTEL splits them into the 60 videos linked in this guide.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 760 210" width="760" height="210" role="img" aria-label="Course flow from algorithms to system optimizations">
  <g class="t-sm">
    <rect x="10" y="20" width="170" height="70" rx="6" class="f-cs s-c w15"/><text x="95" y="48" text-anchor="middle" class="t-b">CNNs</text><text x="95" y="68" text-anchor="middle" class="t-mut">conv, layers, models</text>
    <rect x="200" y="20" width="170" height="70" rx="6" class="f-ms s-m w15"/><text x="285" y="48" text-anchor="middle" class="t-b">CNN hardware</text><text x="285" y="68" text-anchor="middle" class="t-mut">dataflow, accelerators, pruning</text>
    <rect x="390" y="20" width="170" height="70" rx="6" class="f-vs s-v w15"/><text x="475" y="48" text-anchor="middle" class="t-b">Training at scale</text><text x="475" y="68" text-anchor="middle" class="t-mut">parallelism, checkpoints</text>
    <rect x="580" y="20" width="170" height="70" rx="6" class="f-cs s-c w15"/><text x="665" y="48" text-anchor="middle" class="t-b">LLMs</text><text x="665" y="68" text-anchor="middle" class="t-mut">KV cache, serving, decoding</text>
    <rect x="105" y="120" width="170" height="70" rx="6" class="f-ms s-m w15"/><text x="190" y="148" text-anchor="middle" class="t-b">GNNs</text><text x="190" y="168" text-anchor="middle" class="t-mut">aggregation, HyGCN</text>
    <rect x="295" y="120" width="170" height="70" rx="6" class="f-vs s-v w15"/><text x="380" y="148" text-anchor="middle" class="t-b">Emerging hardware</text><text x="380" y="168" text-anchor="middle" class="t-mut">IMC, NoC, chiplets</text>
    <rect x="485" y="120" width="170" height="70" rx="6" class="f-cs s-c w15"/><text x="570" y="148" text-anchor="middle" class="t-b">Real systems</text><text x="570" y="168" text-anchor="middle" class="t-mut">profiling, NPU, GPU</text>
  </g>
  <path d="M180 55h18M370 55h18M560 55h18" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M665 90 C 665 105, 190 100, 190 118" class="f-none s-mut w15 dash" marker-end="url(#arr-mut)"/>
  <path d="M275 155h18M465 155h18" class="s-mut w15" marker-end="url(#arr-mut)"/>
</svg></div>
<figcaption>The path through the course. Each block pairs an algorithm family with the system techniques that speed it up.</figcaption></figure>
<p>The first lecture also lists skills the instructor wants you to leave with: tools (LaTeX, Weka, Origin), communication (taking notes, writing project reports, presenting), strong analysis skills, networking through group projects, and timeliness.</p>`
    },
    {
      id: 'why-ml', title: 'Why machine learning?',
      html: String.raw`
<p>Many useful tasks are <b>estimation or prediction problems with too many factors</b> to model by hand:</p>
<ul>
  <li><b>Weather prediction.</b> Tomorrow's temperature depends on countless natural factors, many not fully understood.</li>
  <li><b>Face detection.</b> Your phone unlocks whether you are tired, lit from the side or standing in front of a different background.</li>
  <li><b>Sentence construction.</b> The reply from a shopping site's chat window is generated automatically, not typed by a person.</li>
</ul>
<p>Contrast this with distance = velocity × time, which is easy to model analytically. Some problems do have exact analytical models, like the Navier–Stokes equations of fluid flow, but they are <b>too compute-intensive</b> to solve directly.</p>
<div class="box def"><p><b>Machine learning</b> learns a model from enough prior observations. The inputs it learns from are called <b>features</b>: to predict tomorrow's temperature you might use today's temperature, rainfall, wind speed and direction, and the same for previous days.</p></div>
<p>ML research is growing faster than Moore's law. A plot from J. Dean et al. (IEEE Micro, 2018) shows ML papers on arXiv outpacing a curve that doubles every two years. NeurIPS 2023 received <b>13,300</b> submissions and accepted <b>3,540</b>, roughly a hundred new ML papers every day across venues.</p>
<p>The slides call this the <b>third wave</b> of AI: after two hype-and-disillusionment cycles, this wave has crossed the threshold and is still rising.</p>`
    },
    {
      id: 'changed', title: 'What actually changed: a cycle',
      html: String.raw`
<p>Three things reinforce each other:</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 300" width="720" height="300" role="img" aria-label="The virtuous cycle of data, models and hardware">
  <circle cx="360" cy="150" r="104" class="f-none s-line w2 dash"/>
  <g class="t-sm">
    <rect x="260" y="10" width="200" height="66" rx="8" class="f-ms s-m w15"/><text x="360" y="36" text-anchor="middle" class="t-b">Large datasets, new apps</text><text x="360" y="56" text-anchor="middle" class="t-mut">e.g. autonomous driving</text>
    <rect x="480" y="160" width="230" height="84" rx="8" class="f-cs s-c w15"/><text x="595" y="186" text-anchor="middle" class="t-b">More sophisticated models</text><text x="595" y="206" text-anchor="middle" class="t-mut">LR &lt; RT/DT &lt; DNN &lt; CNN</text><text x="595" y="224" text-anchor="middle" class="t-mut">&lt; GNN &lt; LSTM &lt; Transformer</text>
    <rect x="10" y="160" width="230" height="84" rx="8" class="f-vs s-v w15"/><text x="125" y="186" text-anchor="middle" class="t-b">Faster hardware</text><text x="125" y="206" text-anchor="middle" class="t-mut">CPU &lt; GPU &lt; TPU &lt; accelerators</text><text x="125" y="224" text-anchor="middle" class="t-mut">makes hard problems feasible</text>
  </g>
  <path d="M440 78 C 520 100, 560 120, 580 156" class="f-none s-c w2" marker-end="url(#arr-c)"/>
  <text x="560" y="112" class="t-sm t-c">need more compute</text>
  <path d="M480 220 C 400 270, 320 270, 242 220" class="f-none s-v w2" marker-end="url(#arr-v)"/>
  <text x="360" y="285" text-anchor="middle" class="t-sm t-v">drive new hardware</text>
  <path d="M140 158 C 160 110, 200 80, 258 60" class="f-none s-m w2" marker-end="url(#arr-m)"/>
  <text x="128" y="104" class="t-sm t-m">generate more data and bigger ambitions</text>
</svg></div>
<figcaption>"It's a cycle." Better hardware lets people build heavier models, which then outgrow the hardware again.</figcaption></figure>
<p><b>Data processing</b> changes too. ML makes sense of massive data, and in many domains 100% correctness is not needed: predicting 37 °C or 39 °C when the truth is 38 °C is fine. Classic supervised learning needs labelled data and puts GPUs to work; newer domains need no labelling and put accelerators to work.</p>`
    },
    {
      id: 'moore', title: 'Moore\'s law, Dennard scaling and parallelism',
      html: String.raw`
<div class="grid2">
  <div class="tile"><h4>Moore's law</h4><p>An <b>observation</b> (not a law of physics) that the number of transistors in an integrated circuit doubles about every two years. Gordon Moore co-founded Intel. The industry chased the observation and made it come true.</p></div>
  <div class="tile"><h4>Dennard scaling</h4><p>As transistors get smaller, their <b>power density stays constant</b>, so a chip with more, smaller transistors does not get hotter per unit area.</p></div>
</div>
<p>To keep benefiting from both, <b>parallelism is forced on hardware</b>: phones and laptops now ship quad-core and octa-core processors, and GPUs have thousands of simple cores. Parallelism is also <b>inherent in ML</b>: the many multiplications in a layer are independent of each other. The lecture calls this a <b>symbiotic relationship</b>: ML needs parallel hardware, and parallel hardware needs workloads like ML.</p>
<div class="box exam"><ul><li>Moore's law is an <b>observation</b> about transistor count doubling roughly every <b>2 years</b>.</li><li>Dennard scaling is about constant <b>power density</b>.</li><li>Parallelism is "forced on hardware" and "inherent in ML".</li></ul></div>`
    },
    {
      id: 'brain', title: 'From AI to spiking networks',
      html: String.raw`
<figure class="fig"><div class="stage">
<svg viewBox="0 0 640 300" width="640" height="300" role="img" aria-label="Nested sets: AI contains ML contains brain-inspired, which contains spiking and neural networks, which contain deep learning">
  <ellipse cx="320" cy="150" rx="305" ry="140" class="f-panel s-line w1"/>
  <ellipse cx="350" cy="165" rx="250" ry="112" class="f-vs s-v w1"/>
  <ellipse cx="380" cy="180" rx="190" ry="84" class="f-ms s-m w1"/>
  <ellipse cx="300" cy="190" rx="70" ry="44" class="f-surf s-mut w1"/>
  <ellipse cx="450" cy="190" rx="92" ry="56" class="f-cs s-c w1"/>
  <ellipse cx="465" cy="204" rx="56" ry="30" class="f-surf s-c w1"/>
  <g class="t-sm">
    <text x="70" y="80" class="t-b">Artificial intelligence</text>
    <text x="150" y="122" class="t-b t-v">Machine learning</text>
    <text x="250" y="146" class="t-b t-m">Brain-inspired</text>
    <text x="300" y="194" text-anchor="middle" class="t-b">Spiking</text>
    <text x="450" y="160" text-anchor="middle" class="t-b t-c">Neural networks</text>
    <text x="465" y="208" text-anchor="middle" class="t-b">Deep learning</text>
  </g>
</svg></div>
<figcaption>The family tree used in the first two lectures. This course lives in the neural-network branch.</figcaption></figure>
<div class="grid2">
  <div class="box def" data-t="Artificial intelligence (McCarthy, 1956)"><p>"The science and engineering of creating intelligent machines."</p></div>
  <div class="box def" data-t="Machine learning (Samuel, 1959)"><p>"Field of study that gives computers the ability to learn without being explicitly programmed." A calculator is programmed; a chatbot learns.</p></div>
</div>
<p><b>Brain-inspired</b> algorithms take their basic functionality from our understanding of how the brain works. The brain's basic computational unit is the <b>neuron</b>; a human brain has about <b>86 billion</b> neurons connected by roughly <b>10¹⁴–10¹⁵ synapses</b>. A neuron receives input signals through its <b>dendrites</b> and produces an output along its <b>axon</b>, which reaches the dendrites of other neurons through <b>synaptic weights</b>. These weights are learnable and control how strongly one neuron influences another.</p>
<p><b>Spiking</b> architectures copy the brain's <b>integrate-and-fire</b> behaviour: a unit only computes when a spike (signal) arrives, which makes the hardware asynchronous and very low-power. <b>IBM TrueNorth</b> is the example: 1 million neurons, 256 million synapses, 5.4 billion transistors and only 73 mW.</p>`
    },
    {
      id: 'perceptron', title: 'The perceptron and the multi-layer perceptron',
      html: String.raw`
<p>The <b>perceptron</b>, proposed by Rosenblatt in 1957, is the building block of every neural network. Inputs (features) are multiplied by weights, added together with a bias, and passed through a non-linear <b>activation function</b>.</p>
<div class="formula"><span class="fl">Perceptron output</span><div class="fm">\[ y = f\!\left(w_0\cdot 1 + \sum_{i=1}^{n} w_i x_i\right) \]</div><span class="fn">The constant input 1 with weight w₀ is the bias, so n features need n + 1 weights.</span></div>
<div data-w="perceptron"></div>
<h3>Why the non-linearity matters</h3>
<p>Without an activation function, two layers compute \( y = W_2(W_1 x) = (W_2W_1)x \), which a single layer with weights \(W_2W_1\) computes exactly. Stacking linear layers adds nothing; the non-linearity is what lets depth build richer features. The lecture leaves this as "take-home thinking": try it on paper with two small weight matrices.</p>
<h3>Multi-layer perceptron</h3>
<p>Put many perceptrons side by side and you get a <b>layer</b>; chain layers and you get a <b>multi-layer perceptron (MLP)</b>: an input layer, one or more hidden layers and an output layer. Every neuron of one layer connects to every neuron of the next through a weight (a floating-point number). Researchers found accuracy improves as networks get deeper, which gave us <b>deep learning</b>.</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Type of learning</th><th>What it learns from</th></tr></thead><tbody>
<tr><td>Supervised</td><td>A model M from labelled pairs (x, y). Most of this course assumes supervised learning.</td></tr>
<tr><td>Unsupervised</td><td>Unlabelled data: clustering, outlier detection.</td></tr>
<tr><td>Generative</td><td>Learns to produce new data; most recent LLMs are generative.</td></tr>
<tr><td>Reinforcement</td><td>Outputs are actions, and the "label" is a reward.</td></tr>
</tbody></table></div>`
    },
    {
      id: 'memory-wall', title: 'The memory wall',
      html: String.raw`
<p>Processors got enormously faster, but the paths that feed them did not keep up. The plot below (A. Gholami, 2020) is the single most important picture of the course:</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 660 300" width="660" height="300" role="img" aria-label="Log plot: hardware FLOPs grow 3.1x every two years, DRAM and interconnect bandwidth only 1.4x">
  <line x1="60" y1="250" x2="640" y2="250" class="s-mut w1"/><line x1="60" y1="20" x2="60" y2="250" class="s-mut w1"/>
  <g class="t-sm t-mut"><text x="60" y="268" text-anchor="middle">1996</text><text x="205" y="268" text-anchor="middle">2002</text><text x="350" y="268" text-anchor="middle">2008</text><text x="495" y="268" text-anchor="middle">2014</text><text x="630" y="268" text-anchor="middle">2020</text>
  <text x="52" y="254" text-anchor="end">1</text><text x="52" y="196" text-anchor="end">10²</text><text x="52" y="138" text-anchor="end">10⁴</text><text x="52" y="80" text-anchor="end">10⁶</text></g>
  <line x1="60" y1="250" x2="630" y2="35" class="s-c w3"/>
  <line x1="60" y1="250" x2="630" y2="165" class="s-m w3"/>
  <line x1="60" y1="244" x2="630" y2="172" class="s-v w3 dash"/>
  <g class="t-sm"><text x="300" y="120" class="t-c t-b">Hardware FLOPs: 90,000× in 20 years (3.1× / 2 yrs)</text>
  <text x="330" y="226" class="t-m t-b">DRAM bandwidth: 30× in 20 years (1.4× / 2 yrs)</text>
  <text x="330" y="244" class="t-v">Interconnect bandwidth: 30× (1.4× / 2 yrs)</text></g>
  <path d="M630 40 L630 160" class="s-ink w15" marker-start="url(#arr)" marker-end="url(#arr)"/>
  <text x="622" y="102" text-anchor="end" class="t-sm t-b">the gap</text>
</svg></div>
<figcaption>Peak compute (R10000 → GTX 580 → K40 → TPUs → A100) rose 90,000× over 20 years, while DRAM (DDR3, GDDR5, HBM2) and interconnect (PCIe, NVLink) bandwidth rose only 30×. Redrawn schematically from the lecture slide.</figcaption></figure>
<p>In a normal computer the processor chip (an Intel Core i7, an AMD Ryzen) sits apart from its DRAM (DDR4 sticks on the motherboard). Every weight or activation that is not already in cache must cross <b>off-chip</b> wires to reach the processor and cross them again to be written back. Off-chip transfers cost far more latency and energy than on-chip work. A billion-parameter model has a billion weights, gigabytes that must stream in for every inference. A very fast processor then simply waits for data.</p>
<div class="box insight"><p>Most of this course is about this gap. Reuse data once it is on chip (dataflows), compute inside memory (IMC), shrink the data (pruning, quantization) and schedule work so memory is used well (KV caches, PagedAttention).</p></div>`
    },
    {
      id: 'roadmap', title: 'The roadmap: one bottleneck after another',
      html: String.raw`
<p>Lecture 2 previews the whole course as a chain. Solving each bottleneck exposes the next one:</p>
<ol class="steps">
  <li><div><b>Accelerators</b> are specialised processors for one task or group of tasks (DianNao, Eyeriss). A DNN accelerator runs only DNNs, which is why it can beat a CPU. <a href="#ch06">Chapter 6</a></div></li>
  <li><div><b>Memory is still the bottleneck</b>: someone has to feed weights and activations to the accelerator.</div></li>
  <li><div><b>Accelerators with emerging technology</b>: analog in-memory computing (ISAAC) uses devices that both store weights and compute, removing the processor–memory trips. <a href="#ch14">Chapter 14</a></div></li>
  <li><div><b>Communication becomes the bottleneck</b>: with weights on chip, data now moves around the chip itself. Communication-aware accelerators reduce on-chip traffic.</div></li>
  <li><div><b>Area becomes the bottleneck</b>: storing GPT-3-scale weights on one huge chip would ruin yield and fabrication cost. Fabrication-cost-aware designs use several smaller <b>chiplets</b> on an interposer. <a href="#ch15">Chapter 15</a></div></li>
  <li><div><b>The story does not end</b>: graph and transformer algorithms add complexity, and hardware faces power, fabrication and packaging challenges.</div></li>
</ol>`
    }
  ],
  takeaways: [
    'ML learns models from observations where analytical models are impossible or too expensive to compute.',
    'Data, models and hardware form a cycle: each advance demands the next.',
    'Moore\'s law (an observation) and Dennard scaling pushed hardware towards parallelism, which ML naturally has.',
    'A perceptron computes f(w₀ + Σwᵢxᵢ); without the non-linearity f, stacked layers collapse into one.',
    'Compute grew 3.1× every two years but memory and interconnect bandwidth only 1.4×: the memory wall.',
    'The course follows a chain of bottlenecks: compute → memory → communication → area.'
  ],
  numbers: [
    ['NeurIPS 2023 submissions / acceptances', '13,300 / 3,540', 'ML research grows faster than Moore\'s law'],
    ['Neurons in a human brain', '≈ 86 billion', 'connected by 10¹⁴–10¹⁵ synapses'],
    ['IBM TrueNorth', '1M neurons, 256M synapses', '5.4B transistors at 73 mW'],
    ['Hardware FLOPs growth', '90,000× in 20 years', '3.1× every 2 years'],
    ['DRAM / interconnect bandwidth growth', '30× in 20 years', '1.4× every 2 years'],
    ['Perceptron proposed', '1957 (Rosenblatt)', 'AI coined 1956 (McCarthy); ML defined 1959 (Samuel)']
  ],
  quiz: [
    { q: 'Moore\'s law is best described as…', o: ['A physical law about power density', 'An observation that transistor counts double about every two years', 'A rule that clock frequency doubles every year', 'A guarantee that memory bandwidth keeps pace with compute'], a: 1, why: 'Gordon Moore made an observation, and the industry worked to keep it true. Power density staying constant is Dennard scaling.' },
    { q: 'Dennard scaling states that as transistors shrink…', o: ['their switching speed halves', 'their power density stays constant', 'their leakage current disappears', 'their count doubles'], a: 1, why: 'Constant power density is what let chips add transistors without overheating, until Dennard scaling broke down and parallelism took over.' },
    { q: 'Why does a neural network need a non-linear activation between layers?', o: ['To normalise the outputs to sum to 1', 'Otherwise multiple linear layers collapse into a single equivalent layer', 'To reduce the number of weights', 'To make training converge faster on GPUs only'], a: 1, why: 'W₂(W₁x) = (W₂W₁)x. Without a non-linearity, depth adds no representational power.' },
    { q: 'A perceptron with 5 input features (plus bias) has how many weights?', num: 6, tol: 0, why: 'n features need n weights plus w₀ for the constant bias input: 5 + 1 = 6.' },
    { q: 'According to the memory-wall plot, peak hardware FLOPs grew about ___ every two years.', o: ['1.4×', '2×', '3.1×', '10×'], a: 2, why: 'Hardware FLOPs grew 3.1× every two years (90,000× over 20 years) while DRAM and interconnect bandwidth grew only 1.4× every two years.' },
    { q: 'IBM TrueNorth is an example of which kind of architecture?', o: ['Systolic array', 'Spiking, integrate-and-fire', 'Analog in-memory crossbar', 'Chiplet-based 2.5D'], a: 1, why: 'TrueNorth is a brain-inspired spiking chip: 1M neurons, 256M synapses, 5.4B transistors, 73 mW.' },
    { q: 'In the course roadmap, what bottleneck appears once in-memory computing removes most off-chip memory traffic?', o: ['Clock frequency', 'On-chip communication', 'Instruction decoding', 'Disk I/O'], a: 1, why: 'With weights stored on chip, data now moves around the chip itself, so communication becomes the bottleneck, leading to communication-aware accelerators.' },
    { q: 'Why do chiplet-based (2.5D) designs appear in the roadmap?', o: ['A huge monolithic chip has low yield and high fabrication cost', 'Chiplets compute faster per transistor', 'Chiplets avoid all communication', 'They remove the need for memory'], a: 0, why: 'Storing very large models on one big die makes area the bottleneck; splitting it into chiplets improves yield and cost.' },
    { q: 'In reinforcement learning, the output and the "label" correspond to…', o: ['class and probability', 'action and reward', 'cluster and centroid', 'token and embedding'], a: 1, why: 'The lecture: output → action, label → reward.' },
    { q: 'Which statement about accelerators is correct?', o: ['They are general-purpose processors with more cores', 'They are specialised processors for a specific task or group of tasks', 'They remove the need for DRAM', 'They are only used for training'], a: 1, why: 'A DNN accelerator can only run DNNs; that specialisation is where its speed and efficiency come from.' }
  ],
  cards: [
    { f: 'Moore\'s law', b: 'Observation (Gordon Moore, Intel) that transistor count on an IC doubles about every 2 years.' },
    { f: 'Dennard scaling', b: 'As transistors shrink, power density stays constant.' },
    { f: 'Why parallelism?', b: 'Forced on hardware to keep scaling; inherent in ML. A symbiotic relationship.' },
    { f: 'Perceptron formula', b: 'y = f(w₀ + Σ wᵢxᵢ). Rosenblatt, 1957.' },
    { f: 'Why non-linearity?', b: 'Without it, W₂(W₁x) = (W₂W₁)x, so layers collapse into one.' },
    { f: 'The memory wall in numbers', b: 'FLOPs 3.1× / 2 yrs vs DRAM and interconnect bandwidth 1.4× / 2 yrs.' },
    { f: 'IBM TrueNorth', b: 'Spiking, integrate-and-fire: 1M neurons, 256M synapses, 5.4B transistors, 73 mW.' },
    { f: 'Course bottleneck chain', b: 'Compute → memory → communication → area (chiplets), plus power, fabrication and packaging.' }
  ]
});

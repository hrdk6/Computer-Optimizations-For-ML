CSO.register({
  id: 'ch15', num: 15, part: 'VI', kind: 'comm', span: 6, cover: 'hero',
  coverAlt: 'A package of chiplets on a silicon interposer, connected by glowing on-package links.',
  title: 'IMC for GNNs and transformers, and 2.5D chiplets', short: 'IMC systems and chiplets',
  lectures: [46, 47, 48, 49, 50, 51],
  summary: 'Applying in-memory computing beyond CNNs and scaling it out. COIN accelerates GCNs by reordering A·X·W and balancing on-chip traffic; CANNON prunes with communication in mind; ReTransformer avoids runtime crossbar writes for attention; SIAM models chiplet-based IMC systems; HALO mixes IMC and CMOS chiplets and maps LLM phases to cut communication.',
  sections: [
    {
      id: 'coin', title: 'COIN: communication-aware IMC for GCNs',
      html: String.raw`
<p>A GCN looks like many small DNNs joined by edges, alternating aggregation and combination, with lots of parameters: the Nell dataset has <b>65K nodes and 266K edges</b>. A router per node would make communication energy enormous.</p>
<p>With adjacency matrix A (N × N, 1 where an edge exists), features X and weights W, one layer computes A·X·W. Matrix multiplication is associative, so the <b>order</b> is a free choice, and it matters hugely:</p>
<div class="formula"><span class="fl">Nell: A 65575×65575, X 65575×5414, W 5414×16</span><div class="fm">\[ \underbrace{(A X) W}_{\text{aggregate first}} : 65575^2 \cdot 5414 + 65575 \cdot 5414 \cdot 16 \approx 2.3\times10^{13} \qquad \underbrace{A (X W)}_{\text{extract features first}} : 65575 \cdot 5414 \cdot 16 + 65575^2 \cdot 16 \approx 7.4\times10^{10} \]</div><span class="fn">Extracting features first (COIN's dataflow) needs about 300× fewer multiplications.</span></div>
<div data-w="gcnorder"></div>
<p>COIN (Mandal et al., IEEE JETCAS 2022) is hierarchical: several GCN nodes are mapped to a <b>compute element (CE)</b>, each CE has multiple crossbar tiles for feature extraction, and CEs are joined by NoC routers and a global buffer. Dataflow: <b>feature extraction</b> Z<sub>i</sub> = X<sub>i</sub>·W<sub>i</sub> on the CE tiles → data transfer → <b>aggregation</b> O<sub>i</sub> = A·Z<sub>i</sub> → activation → on-chip transfer.</p>
<h3>How many CEs?</h3>
<p>More CEs mean more inter-CE (NoC) traffic and energy; fewer CEs mean more intra-CE traffic. In the lecture's 8-node example with CE-1 = nodes 1–4 and CE-2 = nodes 5–8, each node sending v bits: intra-CE traffic is 8v in CE-1 (4 links) and 4v in CE-2 (2 links), and inter-CE traffic is 8v (4 links).</p>
<div class="formula"><span class="fl">Communication energy for N nodes on k CEs</span><div class="fm">\[ E(k) = \sum_{i=1}^{L-1} \Big[ \underbrace{\tfrac{N}{k}\big(\tfrac{N}{k} - 1\big)\, a(i)\, k}_{\text{intra-CE}} + \underbrace{\tfrac{N}{k}\cdot\tfrac{N}{k}\, a(i)\, k}_{\text{inter-CE}} \Big] \]</div><span class="fn">Convex in k, so it is solved with an interior-point method.</span></div>
<div data-w="coin"></div>
<div class="box exam" data-t="COIN results"><p>Computation modelled with NeuroSim and communication with BookSim, on GCNs of 2K–65K nodes and 11K–266K edges. Up to <b>6 orders of magnitude</b> lower communication energy than a router-per-node baseline (1.3× vs a C-mesh), up to <b>1100×</b> total energy (Citeseer), up to <b>350×</b> latency, chip area 17.43 mm². EDP: 4 orders better than Jetson Xavier NX, 3 orders better than Jetson AGX Xavier, 2526× better than an NVIDIA Quadro RTX 8000; 105× energy vs AWB-GCN.</p></div>`
    },
    {
      id: 'cannon', title: 'CANNON: communication-aware pruning',
      html: String.raw`
<p>In an IMC chip, each layer's weights sit in one or more tiles, and activations travel tile to tile. Pruning a filter therefore also changes <b>communication</b>. CANNON (Goksoy et al.) prunes filters that have <b>small weights and</b> whose activations travel <b>far</b> on chip, iteratively.</p>
<div class="formula"><span class="fl">z-index (higher is better)</span><div class="fm">\[ z = \frac{\sum |w|}{\text{communication cost (hops)}} \]</div></div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 640 170" width="640" height="170" role="img" aria-label="Two weight columns: sums 1.7 and 3.0, hop costs 1 and 2, z-index 1.7 and 1.5; the second is pruned">
  <g class="t-sm t-mono">
    <text x="100" y="18" text-anchor="middle" class="t-b">column 1</text><text x="200" y="18" text-anchor="middle" class="t-b">column 2</text>
    <g class="f-cs s-c w1"><rect x="70" y="28" width="60" height="22"/><rect x="70" y="52" width="60" height="22"/><rect x="70" y="76" width="60" height="22"/><rect x="70" y="100" width="60" height="22"/></g>
    <g class="f-ms s-m w1"><rect x="170" y="28" width="60" height="22"/><rect x="170" y="52" width="60" height="22"/><rect x="170" y="76" width="60" height="22"/><rect x="170" y="100" width="60" height="22"/></g>
    <text x="100" y="44" text-anchor="middle">0.4</text><text x="100" y="68" text-anchor="middle">−0.3</text><text x="100" y="92" text-anchor="middle">0.9</text><text x="100" y="116" text-anchor="middle">−0.1</text>
    <text x="200" y="44" text-anchor="middle">0.5</text><text x="200" y="68" text-anchor="middle">1.2</text><text x="200" y="92" text-anchor="middle">−1.2</text><text x="200" y="116" text-anchor="middle">0.1</text>
    <text x="10" y="146">Σ|w|</text><text x="100" y="146" text-anchor="middle">1.7</text><text x="200" y="146" text-anchor="middle">3.0</text>
    <text x="300" y="44">hops</text><text x="380" y="44">1</text><text x="440" y="44">2</text>
    <text x="300" y="92">z-index</text><text x="380" y="92" class="t-c">1.7</text><text x="440" y="92" class="t-m">1.5 → prune</text>
  </g>
</svg></div><figcaption>Column 2 has the larger weights but costs twice the hops, so its z-index is lower and it is pruned.</figcaption></figure>
<p>CANNON also does <b>hardware-aware link addition</b>: it adds back connections that are cheap to communicate, yielding a hardware-aware sparse network. On ResNet-152, accuracy and the average z-index both rise during training (z from about 14 to 39 over 200 epochs), and the hop distribution shifts toward fewer hops (also for DenseNet-201). Communication EDP improves by up to about <b>6.2×</b> over mapping-only, SET and SET + mapping baselines (DenseNet, ResNet, VGG on Tiny-ImageNet, CIFAR-100, CIFAR-10).</p>`
    },
    {
      id: 'retransformer', title: 'ReTransformer: attention without runtime writes',
      html: String.raw`
<p>Attention needs R = Q·Kᵀ, a scale, a softmax e<sup>xᵢ</sup>/Σ e<sup>xⱼ</sup>, and S·V; the feed-forward layers are ordinary y = x·W. ReTransformer's hardware has memory subarrays, buffer subarrays and processing subarrays (hybrid softmax, ReRAM-based scaling, ReRAM crossbars).</p>
<div class="box exam" data-t="The problem: compute-write-compute"><p>A crossbar multiplies by whatever is <b>written</b> into it. Q·Kᵀ multiplies by K, an <b>intermediate result</b>, so K would have to be written into a crossbar at runtime, and ReRAM writes are slow and energy-hungry. Naively: write W<sub>Q</sub>, W<sub>K</sub>, W<sub>V</sub>; compute Q = X·W<sub>Q</sub>, K = X·W<sub>K</sub>; <b>write Kᵀ</b>; Out = Q·Kᵀ; S = softmax(Out); <b>write V</b>; Res = S·V.</p></div>
<div class="formula"><span class="fl">Matrix decomposition</span><div class="fm">\[ Q K^{\top} = Q\,(X W_K)^{\top} = \underbrace{(Q\, W_K^{\top})}_{R}\, X^{\top}, \qquad S V = S\,(X W_V) = \underbrace{(S X)}_{P}\, W_V \]</div><span class="fn">Write W_Q, W_Kᵀ, W_V and Xᵀ once; then R = Q·W_Kᵀ, Out = R·Xᵀ, S = softmax(Out), P = S·X, Res = P·W_V. K and V are never written at runtime.</span></div>
<p>Benefits: less time and fewer memory writes, with the same number of computations. Drawback: more crossbar arrays. The optimized MatMul timeline is clearly shorter than the version with the write dependency.</p>`
    },
    {
      id: 'chiplets', title: '2.5D chiplets and SIAM',
      html: String.raw`
<div class="grid3">
  <div class="tile"><h4>Monolithic</h4><p>One big die: <b>low yield</b>.</p></div>
  <div class="tile"><h4>3D IC</h4><p>Stacked dies: <b>thermal hotspots</b>, worse as through-silicon vias (TSVs) multiply.</p></div>
  <div class="tile"><h4>2.5D</h4><p>Small chiplets on a <b>silicon interposer</b>, linked by a network-on-package (NoP): <b>higher yield</b> without much overhead.</p></div>
</div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 190" width="720" height="190" role="img" aria-label="2.5D package: chiplets on an interposer above the package, with micro-bumps and C4 bumps">
  <g class="t-sm">
    <rect x="20" y="150" width="640" height="26" rx="3" class="f-panel s-line w1"/><text x="340" y="168" text-anchor="middle">package substrate</text>
    <g class="f-mut"><circle cx="80" cy="145" r="4"/><circle cx="160" cy="145" r="4"/><circle cx="240" cy="145" r="4"/><circle cx="320" cy="145" r="4"/><circle cx="400" cy="145" r="4"/><circle cx="480" cy="145" r="4"/><circle cx="560" cy="145" r="4"/></g>
    <text x="664" y="160" class="t-mut">C4 bumps</text>
    <rect x="50" y="112" width="580" height="28" rx="3" class="f-vs s-v w1"/><text x="340" y="131" text-anchor="middle">silicon interposer + network-on-package (NoP)</text>
    <g class="f-cs s-c w1"><rect x="70" y="60" width="90" height="44" rx="3"/><rect x="180" y="60" width="90" height="44" rx="3"/><rect x="290" y="60" width="90" height="44" rx="3"/><rect x="400" y="60" width="90" height="44" rx="3"/></g>
    <rect x="510" y="60" width="100" height="44" rx="3" class="f-ms s-m w1"/><text x="560" y="86" text-anchor="middle">global buffer / acc.</text>
    <text x="115" y="86" text-anchor="middle">chiplet</text><text x="225" y="86" text-anchor="middle">chiplet</text><text x="335" y="86" text-anchor="middle">chiplet</text><text x="445" y="86" text-anchor="middle">chiplet</text>
    <text x="340" y="40" text-anchor="middle" class="t-mut">µbumps connect chiplets to the interposer; DRAM sits off-package</text>
  </g>
</svg></div></figure>
<p><b>SIAM</b> (Krishnan et al., ACM TECS 2021) is a simulator for chiplet-based IMC accelerators. Each chiplet holds IMC tiles, a NoC, an accumulator and a buffer; each tile has PEs, pooling, activation, an accumulator, a buffer and a NoP transmitter/receiver and router; each PE has crossbars (RRAM or SRAM cells), MUXes, ADCs/sense amplifiers, shift-and-add and an H-tree.</p>
<div class="grid2">
  <div class="tile"><h4>Inputs</h4><ul><li>DNN structure, precision, sparsity</li><li>Device and technology: node, RRAM/SRAM, bits per cell</li><li>Intra-chiplet: crossbar size, buffers, ADC resolution, read-out, NoC topology and width, frequency</li><li>Inter-chiplet: monolithic or chiplet, homogeneous or custom chiplets, chiplet size and count, global accumulator, NoP frequency and channel width</li></ul></div>
  <div class="tile"><h4>Engines</h4><ul><li><b>Partition and mapping</b>: floorplan and place layers on chiplets and tiles</li><li><b>Circuit and NoC</b>: circuit estimator + trace generation</li><li><b>NoP</b> and <b>DRAM</b> engines</li><li>Output: area, latency, energy, IMC utilization, energy efficiency, throughput, leakage, power</li></ul></div>
</div>
<h3>How SIAM estimates performance</h3>
<ul>
<li><b>Computation</b>: modelling-based. Analytical models of low-level circuits (mux, decoder, ADC/DAC) from the Predictive Technology Model (PTM); count components and scale. Fast.</li>
<li><b>Communication</b>: a whole block of computation finishes at once, so many packets are ready in the same cycle with no particular arrival distribution, and what matters is the <b>total</b> latency, not the average. Queuing-theory models do not fit, so SIAM uses <b>cycle-accurate simulation</b>: generate a trace (source, destination, timestamp), with N<sub>p</sub> = ⌈A<sub>l</sub>·Q/W⌉ packets per layer (activations × quantization bits / bus width) and at most one packet per router per cycle, then run it through BookSim on a mesh, which also reports area and energy.</li>
</ul>
<div class="grid3">
<div data-w="bars" data-o='{"title":"Area","unit":"%","max":100,"labelWidth":70,"barWidth":120,"items":[["NoP",84.7,"v","84.7%"],["IMC",14.6,"c","14.6%"],["NoC",0.7,"m","0.7%"]]}'></div>
<div data-w="bars" data-o='{"title":"Energy","unit":"%","max":100,"labelWidth":70,"barWidth":120,"items":[["IMC",63.4,"c","63.4%"],["NoP",29.1,"v","29.1%"],["NoC",7.4,"m","7.4%"]]}'></div>
<div data-w="bars" data-o='{"title":"Latency","unit":"%","max":100,"labelWidth":70,"barWidth":120,"items":[["IMC",69.7,"c","69.7%"],["NoC",25.7,"m","25.7%"],["NoP",4.6,"v","4.6%"]]}'></div>
</div>
<p>SIAM's other studies: EDAP against tiles per chiplet for 9–36 homogeneous chiplets vs a custom design; NoP EDP vs channel width (8, 16, 32) and chiplet count; ResNet-50 vs VGG-16 energy; ResNet-110 latency and throughput vs chiplets used; SIAM vs SIMBA latency; sensitivity to NoP bandwidth.</p>`
    },
    {
      id: 'halo', title: 'Heterogeneous chiplets for LLMs: HALO',
      html: String.raw`
<div class="grid2">
  <div class="tile"><h4>IMC chiplets</h4><p>Great for <b>weight-static matrix multiplications</b> (WSMM): Q = X·W<sub>Q</sub>, K = X·W<sub>K</sub>, V = X·W<sub>V</sub>, feed-forward layers.</p></div>
  <div class="tile"><h4>CMOS chiplets</h4><p>Needed for <b>dynamic matrix multiplications</b> (DMM) where both inputs change: Q·Kᵀ and S·V. Writing those into IMC would cost too much latency and energy.</p></div>
</div>
<p>So a <b>heterogeneous 2.5D</b> system mixes IMC and CMOS chiplets on a NoP. An LLM is broken into <b>phases</b>: each encoder layer into E·.1–E·.6 (QKV generation, QKᵀ, softmax, SV, FFN, …) and each decoder layer into D·.1–D·.10 (masked self-attention, cross-attention, FFN).</p>
<p><b>HALO</b> (Jaiswal et al., IEEE JETCAS 2024) places IMC chiplets (crossbar tiles, accumulators, buffers, NoP transceivers and routers) and CMOS chiplets (MAC-array PEs, activation, adder, softmax, division, shift-and-add, buffer) on an interposer mesh with DRAM.</p>
<div class="box exam" data-t="Communication is the bottleneck"><p>Up to <b>8 MB</b> of data moves between phases per inference (BERT-style models of 12–32 layers, 512–768 wide), and <b>50–65% of total latency</b> is communication. Mapping phases to chiplets is therefore crucial.</p></div>
<div class="formula"><span class="fl">Mapping cost</span><div class="fm">\[ C_T = \sum_{\text{edges}} \text{volume} \times \text{Manhattan distance} \]</div><span class="fn">Lecture example on a 3×3 mesh: naive row-major mapping costs 36 (the two volume-5 edges are 2 and 3 hops apart); the optimized mapping costs 20 (both heavy edges at distance 1).</span></div>
<div data-w="nocmap"></div>
<p>HALO maps any number of phases with a mix of <b>branch-and-bound</b> (optimal but expensive with many combinations) and <b>sequential mapping</b> (cheaper, sub-optimal), phase by phase. Evaluation uses high-level simulation for IMC chiplets and synthesized RTL for CMOS chiplets, on a 10 × 10 grid of 100 chiplets.</p>
<ul>
<li>IMC is more energy-efficient for weight-stationary multiplications; CMOS for dynamic ones.</li>
<li>Communication latency per chiplet pair is much lower than SIAM's for both encoder and decoder.</li>
<li>Against an NVIDIA Jetson: <b>972× lower latency</b> and <b>1600× lower energy</b>.</li>
</ul>`
    }
  ],
  takeaways: [
    'GCN layer A·X·W: extracting features first (A(XW)) costs ~300× fewer multiplications on Nell than (AX)W.',
    'COIN groups nodes into compute elements and picks the CE count k by minimizing a convex intra- + inter-CE energy model.',
    'CANNON prunes by z-index = Σ|w| / hop cost, so weights whose activations travel far are pruned first; up to ~6.2× better communication EDP.',
    'ReTransformer rewrites Q·Kᵀ = (Q·W_Kᵀ)·Xᵀ and S·V = (S·X)·W_V so no intermediate is written into ReRAM at runtime.',
    '2.5D chiplets on an interposer improve yield over monolithic dies and avoid 3D thermal hotspots; SIAM models them (NoP is 84.7% of area in its example).',
    'SIAM estimates compute analytically and communication by cycle-accurate BookSim simulation of generated traces.',
    'HALO pairs IMC chiplets (weight-static MMs) with CMOS chiplets (dynamic MMs) and maps LLM phases to minimize volume × distance; 972× latency and 1600× energy vs Jetson.'
  ],
  numbers: [
    ['Nell', '65K nodes, 266K edges', 'A 65575², X 65575×5414, W 5414×16'],
    ['Aggregate-first vs extract-first', '2.3×10¹³ vs 7.4×10¹⁰', '~300× fewer'],
    ['COIN comm energy', 'up to 6 orders of magnitude', 'vs router per node'],
    ['COIN total energy / latency', 'up to 1100× / 350×', 'chip 17.43 mm²'],
    ['COIN EDP vs RTX 8000', '2526×', ''],
    ['CANNON comm EDP', 'up to ~6.2×', ''],
    ['SIAM breakdown', 'area NoP 84.7%; energy IMC 63.4%; latency IMC 69.7%', ''],
    ['HALO comm share', '50–65% of latency, up to 8 MB/inference', ''],
    ['HALO vs Jetson', '972× latency, 1600× energy', '']
  ],
  quiz: [
    { q: 'Which order of computing A·X·W is cheaper for Nell?', o: ['(A·X)·W', 'A·(X·W)', 'Both equal', 'Depends on activation'], a: 1, why: 'X·W shrinks 5414 features to 16 before the big N × N product.' },
    { q: 'Increasing the number of COIN compute elements k…', o: ['always lowers energy', 'raises inter-CE traffic while lowering intra-CE traffic', 'has no effect', 'removes the NoC'], a: 1, why: 'The energy model is convex in k, so there is an optimum.' },
    { q: 'CANNON z-index for a column with Σ|w| = 3.0 and cost 2 hops?', num: 1.5, tol: 0.001, why: '3.0 / 2 = 1.5, lower than 1.7 for the other column, so it is pruned.' },
    { q: 'Why is Q·Kᵀ hard for ReRAM crossbars?', o: ['It is too small', 'K is an intermediate result that would have to be written into a crossbar at runtime', 'It needs FP64', 'Softmax cannot be computed'], a: 1, why: 'ReRAM writes are slow and energy-hungry.' },
    { q: 'ReTransformer computes Q·Kᵀ as…', o: ['(Q·W_K)·X', '(Q·W_Kᵀ)·Xᵀ', 'Q·X·W_V', 'Kᵀ·Q'], a: 1, why: 'Q·(X·W_K)ᵀ = Q·W_Kᵀ·Xᵀ, using only pre-written matrices.' },
    { q: 'What is the main advantage of 2.5D over monolithic integration?', o: ['Lower latency always', 'Higher yield', 'No interconnect needed', 'Higher clock'], a: 1, why: 'Small chiplets yield better; 3D adds thermal hotspots.' },
    { q: 'Why does SIAM use cycle-accurate simulation for communication?', o: ['It is faster', 'Packets arrive in bursts without a known distribution, and total latency is needed', 'BookSim is required by law', 'Queuing models are too accurate'], a: 1, why: 'Analytical queuing models assume arrival distributions and give averages.' },
    { q: 'In HALO, which operations go to CMOS chiplets?', o: ['Q = X·W_Q', 'FFN layers', 'Dynamic matmuls like Q·Kᵀ and S·V', 'All of them'], a: 2, why: 'Both operands change, so IMC would need runtime writes.' },
    { q: 'HALO mapping cost on the 3×3 example: naive vs optimized?', o: ['36 vs 20', '20 vs 36', '15 vs 10', '8 vs 5'], a: 0, why: 'Placing the two volume-5 edges at distance 1 cuts the cost from 36 to 20.' }
  ],
  cards: [
    { f: 'COIN dataflow', b: 'Feature extraction Z = X·W on CE crossbars, then aggregation A·Z, then activation and transfer.' },
    { f: 'COIN CE count', b: 'Minimize convex intra-CE + inter-CE energy over k with an interior-point method.' },
    { f: 'CANNON', b: 'Prune by z-index = Σ|w| / hops; add cheap links; up to ~6.2× comm EDP.' },
    { f: 'ReTransformer', b: 'Avoid compute-write-compute: R = Q·W_Kᵀ, Out = R·Xᵀ, P = S·X, Res = P·W_V.' },
    { f: '2.5D integration', b: 'Chiplets on a silicon interposer with a NoP: better yield than monolithic, fewer thermal issues than 3D.' },
    { f: 'SIAM', b: 'Chiplet IMC simulator: analytical circuit models (PTM) + cycle-accurate BookSim for NoC/NoP traces.' },
    { f: 'WSMM vs DMM', b: 'Weight-static matmuls suit IMC chiplets; dynamic matmuls (Q·Kᵀ, S·V) suit CMOS chiplets.' },
    { f: 'HALO', b: 'Heterogeneous IMC + CMOS 2.5D system; maps LLM phases to minimize volume × Manhattan distance.' }
  ]
});

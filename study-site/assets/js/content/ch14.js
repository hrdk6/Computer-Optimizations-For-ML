CSO.register({
  id: 'ch14', num: 14, part: 'VI', kind: 'comm', span: 6, cover: 'crossbar',
  coverAlt: 'A ReRAM crossbar: glowing wordlines and bitlines with a resistive cell at every crossing.',
  title: 'In-memory computing: crossbars, accelerators and their networks', short: 'In-memory computing',
  lectures: [40, 41, 42, 43, 44, 45],
  summary: 'Compute where the data lives. A ReRAM crossbar does a whole matrix-vector product with Ohm\'s and Kirchhoff\'s laws. ISAAC pipelines layers, PipeLayer adds training, AtomLayer goes back to one layer at a time, and NeuroSim models them. Then the new bottleneck, on-chip communication: area-aware tiles, the right number of routers, congestion-free schedules and a NoC with provably minimum latency.',
  sections: [
    {
      id: 'crossbar', title: 'Analog computing in a ReRAM crossbar',
      html: String.raw`
<p>In-memory computing (IMC) does arithmetic inside the memory array, so weights never travel to and from off-chip memory. It is analog: using current (resistive) or charge (capacitive). The course's example is <b>ReRAM (RRAM)</b>, a non-volatile memory that stores a value by changing the resistance of a special dielectric; it belongs to the memristor family.</p>
<div class="formula"><span class="fl">Crossbar dot product</span><div class="fm">\[ I_{\text{cell}} = V \cdot G \;\;(\text{Ohm, } G = 1/R), \qquad I_{\text{bitline}} = \sum_i V_i\, G_i \;\;(\text{Kirchhoff}) \]</div><span class="fn">Weights are conductances, inputs are wordline voltages; each bitline current is a dot product, so the whole crossbar is a vector–matrix multiplier. Columns then go through sample-and-hold, an ADC, and shift-and-add.</span></div>
<div data-w="crossbar"></div>`
    },
    {
      id: 'isaac', title: 'ISAAC: in-situ analog arithmetic',
      html: String.raw`
<p>ISAAC (Shafiee et al., ISCA 2016) is a CNN <b>inference</b> accelerator with in-situ analog arithmetic in crossbars.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 250" width="720" height="250" role="img" aria-label="ISAAC hierarchy: chip of tiles on a concentrated mesh; tile with eDRAM buffer, IMAs, shift-and-add, sigmoid, max-pool; IMA with crossbars, DACs, ADCs">
  <g class="t-sm">
    <text x="110" y="18" text-anchor="middle" class="t-b">chip</text>
    <g class="f-cs s-c w1"><rect x="20" y="30" width="40" height="40" rx="3"/><rect x="70" y="30" width="40" height="40" rx="3"/><rect x="120" y="30" width="40" height="40" rx="3"/><rect x="170" y="30" width="40" height="40" rx="3"/><rect x="20" y="80" width="40" height="40" rx="3"/><rect x="70" y="80" width="40" height="40" rx="3"/><rect x="120" y="80" width="40" height="40" rx="3"/><rect x="170" y="80" width="40" height="40" rx="3"/><rect x="20" y="130" width="40" height="40" rx="3"/><rect x="70" y="130" width="40" height="40" rx="3"/><rect x="120" y="130" width="40" height="40" rx="3"/><rect x="170" y="130" width="40" height="40" rx="3"/></g>
    <text x="115" y="190" text-anchor="middle" class="t-mut">tiles on a concentrated mesh</text>
    <text x="380" y="18" text-anchor="middle" class="t-b">tile</text>
    <rect x="260" y="30" width="240" height="160" rx="6" class="f-panel s-line w1"/>
    <rect x="272" y="42" width="100" height="32" rx="3" class="f-ms s-m w1"/><text x="322" y="62" text-anchor="middle">eDRAM buffer</text>
    <g class="f-cs s-c w1"><rect x="272" y="84" width="50" height="40" rx="3"/><rect x="328" y="84" width="50" height="40" rx="3"/><rect x="384" y="84" width="50" height="40" rx="3"/><rect x="440" y="84" width="50" height="40" rx="3"/></g>
    <text x="297" y="108" text-anchor="middle">IMA</text><text x="353" y="108" text-anchor="middle">IMA</text><text x="409" y="108" text-anchor="middle">IMA</text><text x="465" y="108" text-anchor="middle">IMA</text>
    <rect x="272" y="134" width="50" height="26" rx="3" class="f-panel s-line w1"/><text x="297" y="151" text-anchor="middle">S+A</text>
    <rect x="328" y="134" width="50" height="26" rx="3" class="f-panel s-line w1"/><text x="353" y="151" text-anchor="middle">σ</text>
    <rect x="384" y="134" width="50" height="26" rx="3" class="f-panel s-line w1"/><text x="409" y="151" text-anchor="middle">MP</text>
    <rect x="440" y="134" width="50" height="26" rx="3" class="f-panel s-line w1"/><text x="465" y="151" text-anchor="middle">OR</text>
    <rect x="384" y="42" width="106" height="32" rx="3" class="f-vs s-v w1"/><text x="437" y="62" text-anchor="middle">router</text>
    <text x="610" y="18" text-anchor="middle" class="t-b">IMA</text>
    <rect x="530" y="30" width="180" height="160" rx="6" class="f-panel s-line w1"/>
    <rect x="542" y="42" width="70" height="20" rx="3" class="f-panel s-line w1"/><text x="577" y="56" text-anchor="middle">IR</text>
    <rect x="628" y="42" width="70" height="20" rx="3" class="f-panel s-line w1"/><text x="663" y="56" text-anchor="middle">OR</text>
    <g class="f-cs s-c w1"><rect x="562" y="72" width="50" height="50" rx="2"/><rect x="628" y="72" width="50" height="50" rx="2"/></g>
    <text x="587" y="102" text-anchor="middle">XB</text><text x="653" y="102" text-anchor="middle">XB</text>
    <rect x="542" y="72" width="16" height="50" rx="2" class="f-vs s-v w1"/><text x="550" y="140" text-anchor="middle" class="t-mut">DAC</text>
    <rect x="562" y="130" width="116" height="18" rx="2" class="f-panel s-line w1"/><text x="620" y="143" text-anchor="middle">S+H</text>
    <rect x="562" y="154" width="116" height="24" rx="2" class="f-ms s-m w1"/><text x="620" y="170" text-anchor="middle">ADC, shift &amp; add</text>
  </g>
  <path d="M212 60 L 258 60 M502 104 L 528 104" class="s-mut w1 dash"/>
</svg></div><figcaption>XB crossbar, IMA in-situ multiply-accumulate unit, S+A shift-and-add, σ sigmoid, MP max pool, IR/OR input/output registers.</figcaption></figure>
<h3>Why ISAAC can pipeline layers</h3>
<p>DaDianNao runs layer by layer, with no pipeline. In IMC every memristor both <b>stores</b> a weight and <b>computes</b>, and writing ReRAM costs a lot of energy, so weights cannot be overwritten on the fly: <b>all layers' weights stay resident</b>. Then the layers can work as a pipeline. With a 6×6 ifmap and a 2×2 kernel (one IMA column holding all four weights), as soon as the previous layer has produced outputs 0–7, inputs 0, 1, 6, 7 go to the IMA and the next layer's first output appears; buffer entries are not-yet-received, in-buffer, or serviced-and-released.</p>
<div class="formula"><span class="fl">eDRAM buffer between two pipelined layers</span><div class="fm">\[ \text{with pipelining: } \big(N_x (K_y - 1) + K_x\big) \times N_{if} \qquad \text{without: } N_x \times N_y \times N_{if} \]</div><span class="fn">N_x × N_y ifmap, K_x × K_y kernel, N_if input feature maps.</span></div>
<div data-w="isaacbuf"></div>
<p><b>Precision</b>: inputs are 16-bit. A 16-bit ADC and 2¹⁶ resistance levels per cell would be costly and error-prone, so ISAAC feeds inputs <b>bit-serially</b> (16 binary 0/1 steps) and shifts and adds the partial results.</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Architecture</th><th>CE: GOPS/(s·mm²)</th><th>PE: GOPS/W</th><th>SE: MB/mm²</th></tr></thead>
<tbody>
<tr><td>DaDianNao</td><td>63.46</td><td>286.4</td><td>0.41</td></tr>
<tr><td>ISAAC-CE</td><td><b>478.95</b></td><td>363.7</td><td>0.74</td></tr>
<tr><td>ISAAC-PE</td><td>466.8</td><td><b>380.7</b></td><td>0.71</td></tr>
<tr><td>ISAAC-SE</td><td>140.3</td><td>255.3</td><td><b>54.8</b></td></tr>
</tbody></table></div>
<p>CE = computational efficiency, PE = power efficiency, SE = storage efficiency. Each ISAAC variant is tuned for one metric.</p>`
    },
    {
      id: 'pipelayer', title: 'PipeLayer: training on ReRAM',
      html: String.raw`
<p>PipeLayer (Song et al., HPCA 2017) handles <b>training as well as inference</b>. Training is harder: a weight update needs the next layer's error and data from the earlier forward pass.</p>
<ul>
<li>A <b>spike-based</b> input scheme removes the DAC/ADC overhead.</li>
<li><b>Morphable subarrays</b> can compute <i>and</i> store; <b>memory subarrays</b> only store.</li>
<li><b>Forward</b>: input d₀ enters A₁ at T₁, its MVM output is stored (d₁), and so on to d₃.</li>
<li><b>Backward</b>: each layer produces its error δ<sub>l</sub> and weight gradient ∇W<sub>l</sub> (δ₃ at T₄; ∇W₃ and δ₂ at T₅). With batch size &gt; 1, gradients are buffered and the update happens at the end of the batch.</li>
<li>ISAAC-style pipelines can stall; PipeLayer adds <b>intra-layer parallelism</b> with granularity G by duplicating weights (more hardware, more speed).</li>
<li>Within a batch a new input can enter every cycle; the next batch must wait until the previous batch's update.</li>
</ul>
<div class="formula"><span class="fl">Cycles (L layers, one logical cycle per layer, batch B, N inputs)</span><div class="fm">\[ \text{non-pipelined: } (2L+1)B + 1 \text{ per batch}, \;\; (2L+1)N + \frac{N}{B} \text{ total} \qquad \text{pipelined: } \frac{N}{B}\,(2L + B + 1) \]</div><span class="fn">Forward takes L cycles and backward L + 1.</span></div>
<p>Results: large speed-ups and energy savings over a GPU for MNIST, AlexNet and VGG, in both training and testing.</p>`
    },
    {
      id: 'atomlayer', title: 'AtomLayer: one layer at a time',
      html: String.raw`
<p>AtomLayer (DAC 2018) is a universal ReRAM CNN accelerator built on <b>atomic layer computation</b>: only one layer runs at a time (back to no pipeline). That removes the long latency, the pipeline bubbles and the large on-chip storage that pipelining needs.</p>
<ul>
<li>Architecture: PEs, an on-chip network, an ALU tree (column ALUs and a global ALU) and a global output buffer. Each PE has <b>rotating crossbars</b>, peripherals and four buffers.</li>
<li><b>Rotating crossbars</b>: crossbars are grouped into sets sized to match the peripherals' throughput; each cycle one set connects to the DACs and sample-and-hold; there are at least as many sets as network layers.</li>
<li><b>Row-disjoint filter mapping</b> and a data-reuse system.</li>
</ul>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Design</th><th>GOPs/s/mm²</th><th>GOPs/W</th><th>Area (mm²)</th><th>Power (W)</th><th>VGG-19 latency</th><th>ResNet-152 latency</th></tr></thead>
<tbody>
<tr><td>AtomLayer 160 PE (w/o FC)</td><td>615.7</td><td><b>682.5</b></td><td><b>5.32</b></td><td><b>4.80</b></td><td>6.92 ms</td><td><b>4.01 ms</b></td></tr>
<tr><td>AtomLayer 160 PE (w/ FC)</td><td>475.6</td><td>682.5</td><td>6.89</td><td>4.80</td><td></td><td></td></tr>
<tr><td>ISAAC</td><td>478.9</td><td>627.5</td><td>85.4</td><td>65.8</td><td>8.00 ms</td><td>43.46 ms</td></tr>
<tr><td>PipeLayer</td><td><b>1485</b></td><td>142.9</td><td>82.6</td><td>168.6</td><td><b>2.60 ms</b></td><td>14.13 ms</td></tr>
</tbody></table></div>
<div class="box insight"><p>PipeLayer wins on compute density and on VGG-19 latency, but AtomLayer is tiny and low-power and wins on the deep ResNet-152, where long pipelines suffer.</p></div>`
    },
    {
      id: 'neurosim', title: 'NeuroSim: estimating IMC hardware',
      html: String.raw`
<p>NeuroSim is a performance-analysis tool for IMC systems with an ISAAC-like, tile-based architecture. Analytical models of buffers, ADCs and IMC elements give <b>area, energy, latency and throughput</b>.</p>
<div class="grid2">
  <div class="tile"><h4>Circuit level</h4><ol><li>Sub-circuit constructor (technology, memory cell: SRAM/PCM/ReRAM, general properties)</li><li>Initialize (module interfaces, operation modes, gate sizing)</li><li>CalculateArea (gate dimensions, layout, capacitance)</li><li>CalculateLatency: critical-path delay (Horowitz / RC) × number of operations</li><li>CalculatePower: dynamic C·V<sub>DD</sub>² per operation × operations, plus leakage V<sub>DD</sub>·I<sub>leak</sub></li></ol></div>
  <div class="tile"><h4>Architecture level</h4><ol><li>Synaptic core constructor</li><li>Initialize (array structures, layout, interconnects)</li><li>CalculateArea: bounding box = array area + Σ sub-circuit areas</li><li>CalculateLatency: Σ sub-circuit latencies per operation</li><li>CalculatePower: array static and dynamic energy, leakage</li></ol></div>
</div>`
    },
    {
      id: 'comm', title: 'The new bottleneck: on-chip communication',
      html: String.raw`
<p>IMC removes most off-chip traffic, but deeper and denser DNNs (MLP, SqueezeNet, VGG-16/19, NiN, ResNet-50/152, DenseNet(100, 24)) move more and more data <b>between tiles</b>. In IMC accelerators, on-chip communication causes <b>up to 90% of inference latency</b> and <b>up to 40% of energy</b>.</p>
<h3>Area-aware tile design</h3>
<p>ISAAC uses identical tiles ("one size fits all"). Krishnan et al. (IEEE D&amp;T 2020) instead pick, per layer k, the number of compute elements per tile c<sub>k</sub> and PEs per CE p<sub>k</sub> (heterogeneous tiles, SRAM or ReRAM).</p>
<div class="formula"><span class="fl">Rows and columns of PEs needed by layer k</span><div class="fm">\[ N_k^{r} = \left\lceil \frac{K_{x,k} \, K_{y,k} \, N_k^{if}}{(PE_x)_k} \right\rceil, \qquad N_k^{c} = \left\lceil \frac{N_k^{of} \, N_{bits}}{(PE_y)_k} \right\rceil, \qquad T_k = \left\lceil \frac{N_k^{r}\, N_k^{c}}{c_k\, p_k} \right\rceil \]</div><span class="fn">(PE_x)_k × (PE_y)_k: crossbar rows × columns; N_bits: weight precision; T_k: tiles for layer k.</span></div>
<div class="formula"><span class="fl">Area cost to minimize</span><div class="fm">\[ A_k(c_k, p_k) = \big(c_k\, p_k\, T_k - N_k^{r} N_k^{c}\big) \times T_k^{2}, \qquad c_{min} \le c_k \le c_{max},\; p_{min} \le p_k \le p_{max} \]</div><span class="fn">The bracket is the residual area (unused PEs).</span></div>
<h3>How many routers per layer?</h3>
<p>Area optimization alone is not enough: with one router per tile, the NoC is huge (mesh size ~30–35 for DenseNet(100, 24) and ResNet-50) and burns power. With n<sub>k</sub> routers for layer k and I<sub>k</sub> activations from layer k to k + 1, each source–destination pair carries I<sub>k</sub>/(n<sub>k</sub> n<sub>k+1</sub>) activations.</p>
<div class="formula"><span class="fl">NoC energy objective</span><div class="fm">\[ \min_{\bar n}\; E(\bar n) = \left(\sum_{k=1}^{K-1} \frac{I_k}{n_k\, n_{k+1}}\right) \cdot \left(\sum_{k=1}^{K-1} n_k\right) \quad \text{s.t. } n_k \ge 1,\; \sum_k n_k &lt; N \]</div><span class="fn">More routers mean less traffic per pair but more routers burning energy. After optimization the mesh shrinks to about 12–16 and NoC power drops sharply.</span></div>`
    },
    {
      id: 'schedule', title: 'Congestion-free and minimum-latency communication',
      html: String.raw`
<p>On a 3×3 mesh with Y-X routing, put layer 1 on nodes 0–3 and layer 2 on nodes 4–5; every layer-1 tile sends to every layer-2 tile. Link 3→4 is used by both 0→4 and 3→4 traffic: <b>congestion</b>. The transfers' time windows must not overlap on a shared link.</p>
<div class="formula"><span class="fl">Packet scheduling (solved with IBM CPLEX)</span><div class="fm">\[ \begin{aligned} \min\; & t_{terminal} \\ \text{s.t. } & t_{mn} > t_{pq} + n_{pq} \;\lor\; t_{pq} > t_{mn} + n_{mn} \quad \forall (t_{mn}, t_{pq}) \in C \\ & t_{xy} \ge 0, \quad t_{terminal} > t_{xy} + n_{xy} \quad \forall t_{xy} \in T \end{aligned} \]</div><span class="fn">t_sd: start of transaction s → d; n: its number of packets; C: pairs of tasks that share a link; T: all tasks. Conflicting tasks must not overlap in time.</span></div>
<h3>The minimum possible latency</h3>
<p>Key insight: a router cannot send or receive more than one packet per cycle, but many routers can work in parallel. If no link carries more than one transaction per cycle, there is no congestion. For two consecutive layers with N routers each, all-to-all needs N² packets and each receiving router accepts one per cycle, so <b>N cycles is the minimum</b>. A custom interconnect reaches it:</p>
<ul>
<li><b>Horizontal links</b> R<sub>k,n</sub> → R<sub>k+1,n</sub>, used in cycle 1.</li>
<li><b>Vertical up and down links</b> between neighbouring routers of layer k + 1, which forward the remaining packets in later cycles.</li>
</ul>
<div data-w="mininter"></div>
<p>A proof by induction (from N − 1 to N routers) gives general schedules: the horizontal link L<sub>k,n</sub>–L<sub>k+1,n</sub> carries T<sub>k,n</sub> → T<sub>k+1,n</sub> in cycle 1; in cycle m the upward link L<sub>k+1,n</sub>–L<sub>k+1,n−1</sub> carries T<sub>k,n+m−2</sub> → T<sub>k+1,n−1</sub> and the downward link L<sub>k+1,n</sub>–L<sub>k+1,n+1</sub> carries T<sub>k,n−m+2</sub> → T<sub>k+1,n+1</sub>, when those exist. Schedules also exist for unequal layers (N and N + j routers).</p>
<h3>A reconfigurable NoC</h3>
<p>CNNs fall into edge and cloud classes, and networks in one class need similar router counts per layer. So the chip <b>reserves routers per layer</b> (the maximum across the class, e.g. layer 1 needs 4, 2, 5, 4, 6 routers for LeNet-5, NiN-12, SqueezeNet-26, VGG-16, VGG-19, so reserve 6) and, before running a network, configures how many routers each layer uses and the optimal schedule. It supports CNNs up to 26 layers; a network limited to the reserved routers may be sub-optimal but still beats a mesh.</p>
<div class="box exam" data-t="Results (Mandal et al., IEEE JETCAS 2020)"><p>Up to <b>8×</b> lower communication latency per layer on VGG-19, and up to <b>25%</b> lower end-to-end inference latency across DNNs.</p></div>`
    }
  ],
  takeaways: [
    'A ReRAM crossbar stores weights as conductances; Ohm\'s law multiplies and Kirchhoff\'s law sums, giving an analog matrix-vector product in place.',
    'ISAAC keeps all weights resident (ReRAM writes are costly), so layers can be pipelined with a buffer of (N_x(K_y − 1) + K_x)·N_if; inputs are fed bit-serially.',
    'ISAAC beats DaDianNao on compute, power and storage efficiency (e.g. 478.95 vs 63.46 GOPS/s/mm²).',
    'PipeLayer adds training with morphable subarrays and spike inputs: pipelined (N/B)(2L + B + 1) cycles vs (2L + 1)N + N/B.',
    'AtomLayer runs one layer at a time with rotating crossbars: tiny area and power, best on deep ResNet-152.',
    'On-chip communication causes up to 90% of latency and 40% of energy in IMC accelerators.',
    'Area-aware tiles minimize unused PEs; router counts per layer trade traffic per pair against router energy.',
    'With one packet per router per cycle, all-to-all between N-router layers needs N cycles; a custom interconnect achieves it congestion-free; a reconfigurable NoC gives up to 8× lower communication latency.'
  ],
  numbers: [
    ['ISAAC CE vs DaDianNao', '478.95 vs 63.46 GOPS/(s·mm²)', 'ISAAC-CE'],
    ['ISAAC-SE storage efficiency', '54.8 MB/mm²', 'vs 0.41 for DaDianNao'],
    ['ISAAC input precision', '16 bits, fed bit-serially', ''],
    ['AtomLayer 160 PE', '682.5 GOPs/W, 5.32 mm², 4.80 W', ''],
    ['ResNet-152 latency', 'AtomLayer 4.01 ms, ISAAC 43.46 ms, PipeLayer 14.13 ms', ''],
    ['IMC communication share', 'up to 90% latency, 40% energy', ''],
    ['Minimum all-to-all latency', 'N cycles', 'N routers per layer'],
    ['Reconfigurable NoC', 'up to 8× comm latency, 25% inference latency', 'VGG-19 layers / across DNNs']
  ],
  quiz: [
    { q: 'In a ReRAM crossbar, which physical law performs the summation?', o: ['Ohm\'s law', 'Kirchhoff\'s current law', 'Faraday\'s law', 'Moore\'s law'], a: 1, why: 'Currents on a bitline add up; Ohm\'s law does the multiplication.' },
    { q: 'Why can ISAAC pipeline layers while DaDianNao does not?', o: ['ISAAC has more SRAM', 'All weights stay resident in crossbars because ReRAM writes are expensive', 'ISAAC uses FP32', 'ISAAC has no ADCs'], a: 1, why: 'Every layer has its own crossbars, so they can run concurrently.' },
    { q: 'Pipelined buffer for a 6×6 ifmap, 2×2 kernel, 1 map: (N_x(K_y − 1) + K_x)·N_if = ?', num: 8, tol: 0, why: '6 × 1 + 2 = 8 values, matching outputs 0–7 in the lecture.' },
    { q: 'How does ISAAC avoid needing a 16-bit ADC?', o: ['It uses 4-bit weights', 'It feeds inputs bit-serially and shifts and adds', 'It uses digital multipliers', 'It drops precision to 8 bits'], a: 1, why: '16 binary steps per input, results shifted and added.' },
    { q: 'What does PipeLayer add over ISAAC?', o: ['Only inference', 'Training support with morphable subarrays and spike-based inputs', 'SRAM crossbars', 'A systolic array'], a: 1, why: 'It computes errors and gradients, and removes DAC/ADC overhead with spikes.' },
    { q: 'Pipelined PipeLayer cycles for N = 8 inputs, B = 4, L = 3?', num: 22, tol: 0, why: '(N/B)(2L + B + 1) = 2 × 11 = 22.' },
    { q: 'AtomLayer\'s key idea is…', o: ['deeper pipelines', 'atomic layer computation: one layer at a time', 'chiplets', 'digital MACs'], a: 1, why: 'It removes pipeline bubbles and large buffers.' },
    { q: 'Up to what share of IMC inference latency comes from on-chip communication?', o: ['10%', '40%', '90%', '100%'], a: 2, why: 'And up to 40% of the energy.' },
    { q: 'In the router-count objective, increasing n_k…', o: ['always lowers energy', 'lowers traffic per pair but adds router cost', 'has no effect', 'raises traffic per pair'], a: 1, why: 'E = (Σ I_k / (n_k n_{k+1})) × (Σ n_k) captures the trade-off.' },
    { q: 'Minimum cycles for all-to-all between two layers of 4 routers each, one packet per router per cycle?', num: 4, tol: 0, why: '16 packets, each receiver takes one per cycle: 4 cycles.' }
  ],
  cards: [
    { f: 'Crossbar MVM', b: 'Weights = conductances G; inputs = voltages V; I = Σ V·G per bitline (Ohm + Kirchhoff).' },
    { f: 'ISAAC', b: 'Tiles of IMAs (crossbars, DAC, ADC, S+H) on c-mesh; inference only; layers pipelined; bit-serial 16-bit inputs.' },
    { f: 'ISAAC pipeline buffer', b: '(N_x(K_y − 1) + K_x)·N_if instead of N_x·N_y·N_if.' },
    { f: 'PipeLayer', b: 'ReRAM training + inference; morphable vs memory subarrays; spike inputs; pipelined (N/B)(2L + B + 1) cycles.' },
    { f: 'AtomLayer', b: 'One layer at a time; rotating crossbars; row-disjoint filter mapping; tiny area and power.' },
    { f: 'NeuroSim', b: 'Circuit- and architecture-level analytical models → area, latency, energy, throughput of IMC.' },
    { f: 'Area-aware tiles', b: 'Choose CEs per tile and PEs per CE per layer to minimize (c·p·T − N^r N^c)·T².' },
    { f: 'Router count objective', b: 'E = (Σ I_k/(n_k n_{k+1})) · (Σ n_k).' },
    { f: 'Minimum-latency NoC', b: 'Horizontal + vertical links; N routers → N cycles, no congestion; reconfigurable per CNN.' }
  ]
});

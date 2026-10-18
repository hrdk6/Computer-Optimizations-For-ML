CSO.register({
  id: 'ch10', num: 10, part: 'IV', kind: 'memory', span: 4, cover: 'kvblocks',
  coverAlt: 'Rows of small memory blocks, some filled with glowing key and value tokens, scattered across a GPU memory plane.',
  title: 'Fast LLM inference: FlashAttention, speculation and the KV cache', short: 'Fast LLM inference',
  lectures: [26, 27, 28, 29],
  summary: 'Four ideas that make LLMs fast. FlashAttention tiles attention so it barely touches HBM. Speculative decoding and sampling let a small draft model guess tokens that the big model verifies in one pass. The KV cache stops recomputing old keys and values, and PagedAttention (vLLM) manages that cache like virtual memory.',
  sections: [
    {
      id: 'flash-problem', title: 'Standard attention is an HBM round trip',
      html: String.raw`
<p>With Q, K, V ∈ ℝ<sup>N×d</sup> in GPU high-bandwidth memory (HBM), N the sequence length and d the head dimension, standard attention does:</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 200" width="720" height="200" role="img" aria-label="Standard attention writes S and P to HBM and reads them back">
  <g class="t-sm">
    <rect x="10" y="140" width="700" height="44" rx="6" class="f-ms s-m w15"/><text x="360" y="167" text-anchor="middle" class="t-b">HBM (off-chip): Q, K, V, S, P, O</text>
    <rect x="40" y="20" width="170" height="60" rx="6" class="f-cs s-c w1"/><text x="125" y="46" text-anchor="middle" class="t-b">① S = QKᵀ</text><text x="125" y="64" text-anchor="middle" class="t-mut">load Q, K; write S</text>
    <rect x="275" y="20" width="170" height="60" rx="6" class="f-cs s-c w1"/><text x="360" y="46" text-anchor="middle" class="t-b">② P = softmax(S)</text><text x="360" y="64" text-anchor="middle" class="t-mut">read S; write P</text>
    <rect x="510" y="20" width="170" height="60" rx="6" class="f-cs s-c w1"/><text x="595" y="46" text-anchor="middle" class="t-b">③ O = PV</text><text x="595" y="64" text-anchor="middle" class="t-mut">read P, V; write O</text>
  </g>
  <path d="M90 138V82M160 82v56M325 138V82M395 82v56M560 138V82M630 82v56" class="s-m w15" marker-end="url(#arr-m)"/>
</svg></div><figcaption>Every intermediate N × N matrix goes off-chip and comes back. Off-chip accesses over long metal wires cost latency and energy.</figcaption></figure>`
    },
    {
      id: 'flash', title: 'FlashAttention: tiling plus recomputation',
      html: String.raw`
<div class="grid2">
  <div class="tile"><h4>Tiling</h4><p>Split Q, K, V into blocks, load them from slow HBM into fast on-chip <b>SRAM</b>, and compute attention block by block. Softmax needs the whole row, so a naive block-wise merge would be wrong. FlashAttention keeps two <b>extra statistics per row</b>, the running max m and running sum ℓ, and rescales earlier results. The answer is <b>exact</b>, not an approximation.</p></div>
  <div class="tile"><h4>Recomputation</h4><p>The backward pass needs S = QKᵀ and P = softmax(S). Instead of storing these N × N matrices, FlashAttention <b>recomputes</b> them block by block during the backward pass. A few more FLOPs, far less memory traffic.</p></div>
</div>
<p>With on-chip SRAM of size M, the block sizes are B<sub>c</sub> = ⌈M/4d⌉ and B<sub>r</sub> = min(⌈M/4d⌉, d), giving T<sub>r</sub> = ⌈N/B<sub>r</sub>⌉ and T<sub>c</sub> = ⌈N/B<sub>c</sub>⌉ blocks. The outer loop loads K<sub>j</sub>, V<sub>j</sub> into SRAM; the inner loop loads Q<sub>i</sub>, O<sub>i</sub>, ℓ<sub>i</sub>, m<sub>i</sub> and updates them:</p>
<div class="formula"><span class="fl">FlashAttention inner-loop update</span><div class="fm">\[ \begin{aligned} S_{ij} &= Q_i K_j^{\top}, \quad \tilde m_{ij} = \text{rowmax}(S_{ij}), \quad \tilde P_{ij} = e^{S_{ij} - \tilde m_{ij}}, \quad \tilde\ell_{ij} = \text{rowsum}(\tilde P_{ij}) \\ m_i^{new} &= \max(m_i, \tilde m_{ij}), \qquad \ell_i^{new} = e^{m_i - m_i^{new}}\,\ell_i + e^{\tilde m_{ij} - m_i^{new}}\,\tilde\ell_{ij} \\ O_i &\leftarrow \text{diag}(\ell_i^{new})^{-1}\Big(\text{diag}(\ell_i)\, e^{m_i - m_i^{new}}\, O_i + e^{\tilde m_{ij} - m_i^{new}}\, \tilde P_{ij} V_j\Big) \end{aligned} \]</div><span class="fn">The statistics have fixed size: they do not grow with the sequence length.</span></div>
<div data-w="flash"></div>
<div data-w="bars" data-o='{"title":"GPT-2 medium attention on A100","hint":"seq 1024, head dim 64, 16 heads, batch 64","labelWidth":210,"items":[["GFLOPs, standard",66.6,"m","66.6"],["GFLOPs, FlashAttention",75.2,"c","75.2 (+13%)"],["HBM read/write GB, standard",40.3,"m","40.3 GB"],["HBM read/write GB, Flash",4.4,"c","4.4 GB (~9× less)"],["Runtime ms, standard",41.7,"m","41.7 ms"],["Runtime ms, Flash",7.3,"c","7.3 ms (~5.7× faster)"]],"note":"More FLOPs (recomputation) yet much faster, because HBM traffic falls about 9×."}'></div>
<div class="box exam" data-t="Moral"><p>LLMs are about <b>memory</b>, not just compute.</p></div>`
    },
    {
      id: 'autoreg', title: 'Prefill and decode: one token per forward pass',
      html: String.raw`
<p>A decoder-only model given "&lt;s&gt; The cat sat" runs <b>forward pass 1</b> on the whole prompt (the <b>prefill</b>), producing a probability distribution at every position; the most likely token at the last position, "on", becomes position 4. Pass 2 gives "a", pass 3 "mat", pass 4 "&lt;/s&gt;".</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 120" width="700" height="120" role="img" aria-label="Four forward passes produce four tokens">
  <g class="t-sm">
    <g class="f-ms s-m w1"><rect x="20" y="40" width="40" height="30" rx="3"/><rect x="62" y="40" width="50" height="30" rx="3"/><rect x="114" y="40" width="50" height="30" rx="3"/><rect x="166" y="40" width="50" height="30" rx="3"/></g>
    <text x="40" y="60" text-anchor="middle">&lt;s&gt;</text><text x="87" y="60" text-anchor="middle">The</text><text x="139" y="60" text-anchor="middle">cat</text><text x="191" y="60" text-anchor="middle">sat</text>
    <g class="f-cs s-c w1"><rect x="260" y="40" width="70" height="30" rx="3"/><rect x="360" y="40" width="70" height="30" rx="3"/><rect x="460" y="40" width="70" height="30" rx="3"/><rect x="560" y="40" width="80" height="30" rx="3"/></g>
    <text x="295" y="60" text-anchor="middle">on</text><text x="395" y="60" text-anchor="middle">a</text><text x="495" y="60" text-anchor="middle">mat</text><text x="600" y="60" text-anchor="middle">&lt;/s&gt;</text>
    <text x="295" y="98" text-anchor="middle" class="t-mut">pass 1 (prefill)</text><text x="395" y="98" text-anchor="middle" class="t-mut">pass 2</text><text x="495" y="98" text-anchor="middle" class="t-mut">pass 3</text><text x="600" y="98" text-anchor="middle" class="t-mut">pass 4</text>
    <text x="118" y="26" text-anchor="middle" class="t-m">prompt</text><text x="450" y="26" text-anchor="middle" class="t-c">generated</text>
  </g>
  <path d="M220 55h36M330 55h28M430 55h28M530 55h28" class="s-mut w15" marker-end="url(#arr-mut)"/>
</svg></div></figure>
<p>Decoding is <b>autoregressive</b>: K tokens need K serial runs of the big model. Can several tokens be decoded in parallel?</p>`
    },
    {
      id: 'specdec', title: 'Speculative decoding',
      html: String.raw`
<p>Suppose we had a <b>guess</b> for the completion of "The cat sat", say "on the chair &lt;/s&gt;". Append it and run <b>one</b> forward pass: we get the model's own prediction at every position.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 150" width="700" height="150" role="img" aria-label="Verifying a guess: on accepted, the rejected and replaced by a, the rest discarded">
  <g class="t-sm">
    <text x="10" y="34" class="t-b">guess</text><text x="10" y="94" class="t-b">model's pick</text>
    <g class="f-ms s-m w1"><rect x="120" y="14" width="70" height="30" rx="3"/></g><text x="155" y="34" text-anchor="middle">sat</text>
    <rect x="210" y="14" width="70" height="30" rx="3" class="f-cs s-c w15"/><text x="245" y="34" text-anchor="middle">on</text>
    <rect x="300" y="14" width="70" height="30" rx="3" class="f-panel s-m w15"/><text x="335" y="34" text-anchor="middle" class="t-m">the</text>
    <rect x="390" y="14" width="70" height="30" rx="3" class="f-panel s-line w1"/><text x="425" y="34" text-anchor="middle" class="t-mut">chair</text>
    <rect x="480" y="14" width="70" height="30" rx="3" class="f-panel s-line w1"/><text x="515" y="34" text-anchor="middle" class="t-mut">&lt;/s&gt;</text>
    <rect x="210" y="74" width="70" height="30" rx="3" class="f-cs s-c w1"/><text x="245" y="94" text-anchor="middle">on ✓</text>
    <rect x="300" y="74" width="70" height="30" rx="3" class="f-vs s-v w15"/><text x="335" y="94" text-anchor="middle">a</text>
    <text x="440" y="94" class="t-mut">discarded (depended on "the")</text>
    <text x="350" y="138" text-anchor="middle" class="t-c t-b">1 forward pass → 2 tokens ("on", "a")</text>
  </g>
  <path d="M155 46 L 240 72 M245 46v26M335 46v26" class="s-mut w1" marker-end="url(#arr-mut)"/>
</svg></div></figure>
<p>"on" matches, so it is accepted. At the next position the model prefers "a" over the guessed "the", so the guess is rejected there and <b>replaced by the model's own token</b>; everything after it is discarded because it depended on the rejected token. Then repeat with "&lt;s&gt; The cat sat on a" and a new guess.</p>
<h3>Where do guesses come from?</h3>
<p>Some tokens are much easier than others:</p>
<ul>
<li>"I am at Indian Institute <b>of</b>" is easy; "<b>Science</b>" is hard (a 100B model may be needed).</li>
<li>Translating Hebrew to "The president was Barack Obama": "president" is hard (needs Hebrew and context), "Obama" is easy given "Barack".</li>
<li>"A group of flamingos is called a <b>flamboyance</b>": "a" is easy, "flamboyance" is hard (a small model would say "flock").</li>
</ul>
<div class="box insight" data-t="The idea"><p>A much smaller <b>draft model</b> (say 1B) guesses the easy tokens; the large <b>target model</b> (say 100B) verifies and corrects them in one pass.</p></div>
<p>In Leviathan et al.'s example ("japan's benchmark nikkei 225 index rose 226.69 points, or 1.5 percent, to 10,989.79 in late morning trading"), the passes yield 5, 5, 4, 3, 3, 8, 3, 1 and 4 tokens: <b>37 tokens with 9 target passes</b> instead of 37. Each verification also gives one token "for free" (the correction, or a bonus token if everything is accepted).</p>
<p>The draft passes are not free either: they still use the GPU. The hyperparameter <b>γ</b> (or K) sets how many tokens the draft generates per round; too many wastes draft compute. With <b>c</b> = the compute cost ratio of draft to target, a low c allows more guessed tokens per round.</p>`
    },
    {
      id: 'specsample', title: 'Speculative sampling',
      html: String.raw`
<p>Greedy decoding always picks the most probable token, which is deterministic. Real systems <b>sample</b> (top-p, top-k, temperature) for variety and creativity. Speculative sampling (DeepMind and Google Research, concurrently) keeps the <b>exact output distribution</b> of the target model:</p>
<ol>
<li>The draft model M<sub>p</sub> (e.g. Llama-2-7b-chat) runs K = 5 times: p₁ = M<sub>p</sub>(pf) → x₁, p₂ = M<sub>p</sub>(pf, x₁) → x₂, …, x₅.</li>
<li>The target model M<sub>q</sub> (e.g. Llama-2-70b-chat) runs <b>once</b> on (pf, x₁ … x₅), giving distributions q₁ … q₆ over the whole vocabulary.</li>
<li>Check each token in order with <b>rejection sampling</b>; stop at the first rejection.</li>
</ol>
<div class="formula"><span class="fl">Acceptance rule</span><div class="fm">\[ \text{accept } x \text{ with probability } \min\!\left(1,\; \frac{q(x)}{p(x)}\right) \]</div><span class="fn">If q(x) ≥ p(x), always accept. Otherwise draw r ∈ [0, 1] and accept if r &lt; q/p. On rejection, a replacement is sampled from the normalized max(0, q − p).</span></div>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Token</th><th>draft p</th><th>target q</th><th>Decision</th></tr></thead>
<tbody>
<tr><td>dogs</td><td>0.8</td><td>0.9</td><td>accept (q ≥ p)</td></tr>
<tr><td>love</td><td>0.7</td><td>0.8</td><td>accept (q ≥ p)</td></tr>
<tr><td>chasing</td><td>0.9</td><td>0.8</td><td>accept with prob 8/9 ≈ 0.89</td></tr>
<tr><td>after</td><td>0.8</td><td>0.3</td><td>accept with prob 3/8 = 0.375, likely rejected → stop</td></tr>
<tr><td>cars</td><td>0.7</td><td>0.8</td><td>discarded if "after" was rejected</td></tr>
</tbody></table></div>
<div data-w="specsample"></div>
<p>Wall time on an encoder-decoder (T5) example: K = 0 (no speculation) is slowest, K = 3 faster, K = 7 fastest in that plot, though the gain does not keep growing forever.</p>`
    },
    {
      id: 'kvcache', title: 'The KV cache',
      html: String.raw`
<p>The inference pipeline: <b>prompt → tokenization → prefill</b> (whole prompt in parallel, one forward pass) <b>→ decode</b> (N forward passes for N output tokens) <b>→ detokenization → response</b>, with the weights sitting in GPU memory.</p>
<ul>
<li><b>Tokenization</b>: each LLM has its own tokenizer (Llama has about 125k vocabulary entries). "make me sound smart" → [1, 10, 3, 50]; "smarter" adds a sub-word token "er".</li>
<li><b>Embedding</b>: the prompt becomes a matrix X of size L (sequence length) × H (d<sub>model</sub>).</li>
<li><b>Prefill</b>: X (L × H) times W<sub>Q</sub>, W<sub>K</sub>, W<sub>V</sub> (H × H each) gives Q, K, V (L × H); attention gives L × H; the MLP projects up (H × H′) and back down (H′ × H); the logits pick the next token.</li>
</ul>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 730 180" width="730" height="180" role="img" aria-label="Without a cache K and V of all previous tokens are recomputed; with a cache only the new row is computed and appended">
  <g class="t-sm">
    <text x="160" y="18" text-anchor="middle" class="t-b">without KV cache</text>
    <g class="f-ms s-m w1"><rect x="60" y="30" width="200" height="22"/><rect x="60" y="54" width="200" height="22"/><rect x="60" y="78" width="200" height="22"/><rect x="60" y="102" width="200" height="22"/></g>
    <rect x="60" y="126" width="200" height="22" class="f-cs s-c w1"/>
    <text x="160" y="170" text-anchor="middle" class="t-m">K, V of all L + 1 tokens recomputed every step</text>
    <text x="520" y="18" text-anchor="middle" class="t-b">with KV cache</text>
    <g class="f-panel s-line w1"><rect x="420" y="30" width="200" height="22"/><rect x="420" y="54" width="200" height="22"/><rect x="420" y="78" width="200" height="22"/><rect x="420" y="102" width="200" height="22"/></g>
    <rect x="420" y="126" width="200" height="22" class="f-cs s-c w15"/>
    <text x="520" y="90" text-anchor="middle" class="t-mut">cached in HBM</text>
    <text x="640" y="141" class="t-c">new 1×H row</text>
    <text x="520" y="170" text-anchor="middle" class="t-c">only the new token's q, k, v computed; k, v appended</text>
  </g>
</svg></div></figure>
<p>Without a cache, each decode step appends one token, so K and V become (L + 1) × H, and the keys and values of <b>all previous tokens are recomputed every iteration</b>: generating 1000 tokens recomputes the first token's K and V 1000 times. The <b>KV cache</b> saves the K and V of previous tokens; for each new token only its 1 × H query, key and value are computed, and its key and value are appended. The result is exact, with far less compute.</p>
<div class="box exam" data-t="Careful"><p>The KV cache is <b>not a hardware cache</b> (not L1/L2/L3). It is the K and V tensors saved in GPU main memory (HBM). And there is no free lunch: it costs memory.</p></div>`
    },
    {
      id: 'kvmem', title: 'How big is the KV cache?',
      html: String.raw`
<div class="formula"><span class="fl">KV cache size per request</span><div class="fm">\[ \text{KV bytes} = 2 \times p \times n_{layers} \times d_{model} \times seq\_len \quad (\times\ batch) \]</div><span class="fn">2 for K and V; p = bytes per parameter (4 for FP32, 2 for FP16). Far too big for on-chip caches, so it lives in HBM.</span></div>
<div class="box paper" data-t="Worked exercise: Llama-2-7B on an 80 GB A100"><ol><li>FP16 (2 B), 32 layers, d = 4096, sequence 4096, batch 1.</li><li>Weights: 2 B × 7B = <b>14 GB</b>.</li><li>KV cache per request: 2 × 2 × 32 × 4096 × 4096 = <b>2 GB</b>.</li><li>Max batch = (80 − 14) / 2 = <b>33</b>.</li></ol><p>Serving is limited by <b>memory, not compute</b>, and 33 is an overestimate because it assumes perfect packing.</p></div>
<div data-w="kvcalc"></div>`
    },
    {
      id: 'frag', title: 'Why the KV cache needs memory management',
      html: String.raw`
<p>Memory per request = weights (constant) + prefill (one big chunk) + decode (grows one token at a time). Requests differ: long input / short output (summarization, a Teams meeting recap), long / long (rewriting a document), short / long (write an essay), short / short (chatbot Q&amp;A).</p>
<div class="grid2">
<ol>
<li><b>Different requests need different amounts</b> of KV cache.</li>
<li><b>Tensors need contiguous memory.</b> Early systems such as FasterTransformer reserve the <b>maximum model length</b> for every request.</li>
<li>That fixed pre-allocation causes <b>internal fragmentation</b>: "How was your" and "Help me write a" each reserve 10 slots but finish with "day &lt;eos&gt;" and "poem &lt;eos&gt;".</li>
</ol>
<ol start="4">
<li><b>External fragmentation</b>: buddy (power-of-two) allocators leave gaps between allocations.</li>
<li>Memory needs grow <b>one token at a time</b>, so reserved space sits unused for most of a request's life.</li>
</ol>
</div>
<div class="box exam" data-t="Even perfect prediction is not enough"><p>If decode lengths were known exactly, internal and external fragmentation would go away, but a new short prompt ("Cat", needing 3 slots) still cannot be scheduled when only 2 contiguous slots are free, because the rest is reserved for other requests' future growth.</p></div>`
    },
    {
      id: 'paged', title: 'PagedAttention (vLLM)',
      html: String.raw`
<p>Key insight: KV caches need <b>dynamic allocation on demand</b>, exactly like operating-system <b>virtual memory and paging</b>. A <b>KV block</b> is a fixed-size contiguous chunk holding the K and V of a few tokens (say 4), like a page. Logically contiguous blocks can sit anywhere in physical memory, and a new block is allocated only when the previous one fills up.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 230" width="720" height="230" role="img" aria-label="Logical KV blocks mapped through a block table to scattered physical blocks">
  <g class="t-sm">
    <text x="110" y="18" text-anchor="middle" class="t-b">logical KV blocks</text>
    <g class="f-cs s-c w1"><rect x="20" y="30" width="180" height="34" rx="3"/><rect x="20" y="80" width="180" height="34" rx="3"/><rect x="20" y="130" width="180" height="34" rx="3"/></g>
    <text x="110" y="52" text-anchor="middle">Four score and seven</text><text x="110" y="102" text-anchor="middle">years ago our fathers</text><text x="110" y="152" text-anchor="middle">brought forth · · ·</text>
    <text x="10" y="52" text-anchor="end" class="t-mut">0</text><text x="10" y="102" text-anchor="end" class="t-mut">1</text><text x="10" y="152" text-anchor="end" class="t-mut">2</text>
    <text x="330" y="18" text-anchor="middle" class="t-b">block table</text>
    <rect x="260" y="30" width="140" height="134" rx="4" class="f-panel s-line w1"/>
    <text x="300" y="52" text-anchor="middle" class="t-mut">physical</text><text x="365" y="52" text-anchor="middle" class="t-mut">filled</text>
    <text x="300" y="84" text-anchor="middle" class="t-mono">7</text><text x="365" y="84" text-anchor="middle" class="t-mono">4</text>
    <text x="300" y="114" text-anchor="middle" class="t-mono">1</text><text x="365" y="114" text-anchor="middle" class="t-mono">4</text>
    <text x="300" y="144" text-anchor="middle" class="t-mono">3</text><text x="365" y="144" text-anchor="middle" class="t-mono">2</text>
    <text x="590" y="18" text-anchor="middle" class="t-b">physical KV blocks (GPU memory)</text>
    <g class="f-panel s-line w1"><rect x="470" y="30" width="240" height="22"/><rect x="470" y="54" width="240" height="22"/><rect x="470" y="78" width="240" height="22"/><rect x="470" y="102" width="240" height="22"/><rect x="470" y="126" width="240" height="22"/><rect x="470" y="150" width="240" height="22"/><rect x="470" y="174" width="240" height="22"/><rect x="470" y="198" width="240" height="22"/></g>
    <rect x="470" y="54" width="240" height="22" class="f-cs s-c w1"/><text x="590" y="70" text-anchor="middle">years ago our fathers</text>
    <rect x="470" y="102" width="240" height="22" class="f-cs s-c w1"/><text x="590" y="118" text-anchor="middle">brought forth</text>
    <rect x="470" y="198" width="240" height="22" class="f-cs s-c w1"/><text x="590" y="214" text-anchor="middle">Four score and seven</text>
    <text x="462" y="46" text-anchor="end" class="t-mut">0</text><text x="462" y="70" text-anchor="end" class="t-mut">1</text><text x="462" y="94" text-anchor="end" class="t-mut">2</text><text x="462" y="118" text-anchor="end" class="t-mut">3</text><text x="462" y="142" text-anchor="end" class="t-mut">4</text><text x="462" y="166" text-anchor="end" class="t-mut">5</text><text x="462" y="190" text-anchor="end" class="t-mut">6</text><text x="462" y="214" text-anchor="end" class="t-mut">7</text>
  </g>
  <path d="M200 47h58M200 97h58M200 147h58" class="s-mut w1" marker-end="url(#arr-mut)"/>
  <path d="M400 80 C 440 80, 430 209, 468 209 M400 110 C 440 110, 430 65, 468 65 M400 140 C 440 140, 430 113, 468 113" class="f-none s-m w15" marker-end="url(#arr-m)"/>
</svg></div><figcaption>The block table translates logical blocks to physical ones, like a page table. Block 3 is half full; a new block is allocated only when it fills.</figcaption></figure>
<div data-w="paged"></div>
<div class="grid2">
  <div class="box insight" data-t="Memory efficiency"><p><b>No external fragmentation.</b> Internal fragmentation only in the <b>last block</b> of each sequence: fewer wasted tokens than one block. With sequences of 100s–1000s of tokens and blocks of 16 or 32, on average <b>under 4%</b> of the KV cache is wasted.</p></div>
  <div class="box exam" data-t="Serving many requests"><p>Request A ("Four score and seven years ago our fathers brought …") can occupy physical blocks 7, 1, 3 while request B ("It was the best of times") occupies 5 and 2, interleaved freely.</p></div>
</div>
<h3>Paging also enables sharing</h3>
<div class="grid3">
  <div class="tile"><h4>Parallel sampling</h4><p>Several outputs for one prompt (the user picks a favourite). The prompt's blocks are shared with a <b>reference count</b>; when outputs diverge ("fathers" vs "mothers"), the partly filled block is <b>copied on write</b>.</p></div>
  <div class="tile"><h4>Beam search</h4><p>The top-k candidate sequences share blocks; blocks are forked and freed as beams split or are discarded, much like process fork and kill.</p></div>
  <div class="tile"><h4>Prefix sharing</h4><p>A shared few-shot prompt ("Translate English to French: sea otter =&gt; …, peppermint =&gt; …, giraffe =&gt; …") is stored once, like a shared library in an OS.</p></div>
</div>
<h3>The vLLM system</h3>
<p>A <b>centralized scheduler</b> and a <b>KV cache manager</b> with block tables, CPU and GPU block allocators, and workers (cache engine + model shard) on each GPU. Built with PyTorch and Ray (with Megatron-style model parallelism) and publicly available.</p>
<div data-w="bars" data-o='{"title":"vLLM throughput gain (2023)","hint":"LLaMA-7B on A10G, LLaMA-13B on A100","unit":"×","labelWidth":210,"items":[["vs HuggingFace Transformers",24,"c","up to 24×"],["vs Text Generation Inference",3.5,"c","up to 3.5×"]],"note":"The gain comes from fitting a larger batch into the same memory. vLLM also batches more requests than Orca (Max), Orca (Pow2) and even Orca (Oracle), and its memory saving grows with the number of parallel samples and the beam width."}'></div>`
    }
  ],
  takeaways: [
    'Standard attention writes S and P to HBM; FlashAttention tiles Q, K, V into SRAM, keeps running row max and sum for an exact softmax, and recomputes S, P in backward.',
    'FlashAttention on GPT-2 medium: +13% FLOPs, ~9× less HBM traffic, ~5.7× faster. LLMs are about memory.',
    'Autoregressive decoding needs one big-model pass per token.',
    'Speculative decoding: a small draft model guesses, the target verifies in one pass; the first mismatch is replaced and the rest discarded (37 tokens in 9 passes).',
    'Speculative sampling accepts a draft token with probability min(1, q/p), preserving the target distribution.',
    'The KV cache stores past K and V in HBM so each step computes only the new token; size = 2·p·layers·d·seq_len.',
    'Llama-2-7B on an 80 GB A100: 14 GB weights, 2 GB KV per request, at most ~33 requests.',
    'Contiguous max-length pre-allocation wastes memory; PagedAttention uses fixed blocks and a block table (<4% waste) and enables sharing.'
  ],
  numbers: [
    ['FlashAttention GFLOPs', '66.6 → 75.2', 'GPT-2 medium, A100'],
    ['FlashAttention HBM traffic', '40.3 GB → 4.4 GB', '~9× less'],
    ['FlashAttention runtime', '41.7 ms → 7.3 ms', '~5.7× faster'],
    ['Speculative decoding example', '37 tokens, 9 target passes', 'Leviathan et al.'],
    ['Llama vocabulary', '~125k tokens', ''],
    ['Llama-2-7B FP16 weights', '14 GB', '2 B × 7B'],
    ['KV cache per request', '2 GB', '2·2·32·4096·4096 bytes'],
    ['Max batch on 80 GB A100', '33', '(80 − 14) / 2'],
    ['vLLM KV waste', '< 4%', 'block size 16 or 32'],
    ['vLLM throughput', 'up to 24× HF, 3.5× TGI', '2023']
  ],
  quiz: [
    { q: 'What two statistics does FlashAttention track per row to merge softmax blocks exactly?', o: ['Mean and variance', 'Running max m and running sum ℓ', 'Min and max', 'Gradient and Hessian'], a: 1, why: 'They let earlier partial outputs be rescaled when a larger max appears.' },
    { q: 'Why does FlashAttention perform more FLOPs yet run faster?', o: ['It uses FP8', 'It recomputes S and P but cuts HBM traffic ~9×', 'It skips the softmax', 'It approximates attention'], a: 1, why: 'The bottleneck is memory traffic, not arithmetic.' },
    { q: 'Is FlashAttention exact?', o: ['Yes', 'No, it is low-rank', 'Only in FP32', 'Only for short sequences'], a: 0, why: 'Tiling with rescaling gives the exact attention output.' },
    { q: 'In speculative decoding, what happens to guessed tokens after the first mismatch?', o: ['They are accepted anyway', 'They are discarded', 'They are re-verified next pass', 'They become the prompt'], a: 1, why: 'They depended on the rejected token.' },
    { q: 'Draft p = 0.8, target q = 0.3 for a token. Acceptance probability?', num: 0.375, tol: 0.001, why: 'min(1, q/p) = 0.3/0.8 = 0.375.' },
    { q: 'Draft p = 0.7, target q = 0.8. Acceptance probability?', num: 1, tol: 0, why: 'q ≥ p, so the token is always accepted.' },
    { q: 'The KV cache is…', o: ['an L2 cache partition', 'K and V tensors stored in GPU HBM', 'a CPU-side cache', 'a compiler optimization'], a: 1, why: 'It is a software-managed store of past keys and values.' },
    { q: 'KV cache per request for FP16, 32 layers, d = 4096, seq = 4096 (in GB, 1 GB = 2³⁰ B)?', num: 2, tol: 0.01, why: '2 × 2 × 32 × 4096 × 4096 = 2³¹ bytes = 2 GB.' },
    { q: 'Max batch for Llama-2-7B FP16 on an 80 GB A100 with 2 GB KV per request?', num: 33, tol: 0, why: '(80 − 14) / 2 = 33.' },
    { q: 'Where does internal fragmentation remain under PagedAttention?', o: ['Everywhere', 'Only in the last block of each sequence', 'Only in shared prefixes', 'Nowhere'], a: 1, why: 'Blocks fill completely except possibly the last one.' },
    { q: 'How does vLLM handle diverging outputs in parallel sampling?', o: ['Recompute the prompt', 'Copy-on-write of the shared, partially filled block', 'Allocate max length for each', 'Drop one output'], a: 1, why: 'Reference counts plus copy-on-write, like OS pages.' },
    { q: 'Why did systems like FasterTransformer waste KV memory?', o: ['They stored activations', 'They reserved contiguous max-length space per request', 'They used FP32', 'They had no batching'], a: 1, why: 'Fixed pre-allocation causes internal fragmentation and unused reserved space.' }
  ],
  cards: [
    { f: 'FlashAttention', b: 'Tile Q, K, V into SRAM; online softmax with running max m and sum ℓ; recompute S, P in backward. Exact.' },
    { f: 'FlashAttention result', b: 'GPT-2 medium: 66.6 → 75.2 GFLOPs, 40.3 → 4.4 GB HBM, 41.7 → 7.3 ms.' },
    { f: 'Prefill vs decode', b: 'Prefill: whole prompt in one pass. Decode: one token per pass, autoregressive.' },
    { f: 'Speculative decoding', b: 'Draft model guesses easy tokens; target verifies in one pass; replace first mismatch, discard rest.' },
    { f: 'γ and c', b: 'γ: draft tokens per round. c: draft/target compute ratio; low c allows larger γ.' },
    { f: 'Speculative sampling rule', b: 'Accept with probability min(1, q/p); on rejection sample from normalized max(0, q − p).' },
    { f: 'KV cache', b: 'Store past K, V in HBM; compute only the new token\'s q, k, v. Not a hardware cache.' },
    { f: 'KV cache size', b: '2 × bytes × layers × d_model × seq_len (× batch).' },
    { f: 'KV fragmentation', b: 'Max-length reservation → internal fragmentation; buddy allocators → external; incremental growth → unused reservations.' },
    { f: 'PagedAttention', b: 'Fixed-size KV blocks, block table (logical → physical), allocate on demand; <4% waste; sharing via ref counts and copy-on-write.' }
  ]
});

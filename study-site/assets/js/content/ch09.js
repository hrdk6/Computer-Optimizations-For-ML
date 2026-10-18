CSO.register({
  id: 'ch09', num: 9, part: 'IV', kind: 'compute', span: 3, cover: 'attention',
  coverAlt: 'A glowing grid of attention weights linking the words of a sentence to each other.',
  title: 'Transformers from the ground up', short: 'Transformer basics',
  lectures: [24, 25],
  summary: 'Why transformers replaced RNNs, and every block of "Attention is all you need": embeddings, positional encoding, self-attention, multi-head attention, add & norm, the masked decoder and cross-attention, how training differs from inference, and Linformer\'s trick for making attention linear in sequence length.',
  sections: [
    {
      id: 'rnn', title: 'Sequence-to-sequence tasks and the trouble with RNNs',
      html: String.raw`
<p>In <b>seq2seq</b> tasks both input and output are sequences of words: machine translation (Google Translate), text summarization (ChatGPT), chatbots (Amazon). Before transformers, these used <b>recurrent neural networks (RNNs)</b>.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 640 160" width="640" height="160" role="img" aria-label="RNN unrolled over time: each step takes one input and the previous hidden state">
  <g class="t-sm">
    <g class="f-vs s-v w1"><rect x="80" y="60" width="80" height="40" rx="5"/><rect x="220" y="60" width="80" height="40" rx="5"/><rect x="360" y="60" width="80" height="40" rx="5"/><rect x="500" y="60" width="80" height="40" rx="5"/></g>
    <text x="120" y="85" text-anchor="middle">RNN</text><text x="260" y="85" text-anchor="middle">RNN</text><text x="400" y="85" text-anchor="middle">RNN</text><text x="540" y="85" text-anchor="middle">RNN</text>
    <text x="120" y="146" text-anchor="middle">X1</text><text x="260" y="146" text-anchor="middle">X2</text><text x="400" y="146" text-anchor="middle">X3</text><text x="540" y="146" text-anchor="middle">X4</text>
    <text x="120" y="20" text-anchor="middle">Y1</text><text x="260" y="20" text-anchor="middle">Y2</text><text x="400" y="20" text-anchor="middle">Y3</text><text x="540" y="20" text-anchor="middle">Y4</text>
    <text x="20" y="84" class="t-mut">init</text><text x="190" y="70" text-anchor="middle" class="t-mut">hidden</text>
  </g>
  <path d="M120 132v-30M260 132v-30M400 132v-30M540 132v-30M120 58v-30M260 58v-30M400 58v-30M540 58v-30" class="s-mut w1" marker-end="url(#arr-mut)"/>
  <path d="M50 80h28M160 80h58M300 80h58M440 80h58" class="s-v w15" marker-end="url(#arr-v)"/>
</svg></div><figcaption>N tokens need N sequential steps, in training and in inference.</figcaption></figure>
<div class="grid3">
  <div class="tile"><h4>Slow</h4><p>One output per time step: the longer the sequence, the longer the computation.</p></div>
  <div class="tile"><h4>Vanishing gradient</h4><p>Long sequences mean long chains of multiplications, so convergence is slow.</p></div>
  <div class="tile"><h4>Short memory</h4><p>The last token is barely affected by the first, though the context is usually shared across the sentence.</p></div>
</div>`
    },
    {
      id: 'arch', title: 'Attention is all you need',
      html: String.raw`
<p>Vaswani et al. (NeurIPS 2017, over a million citations) introduced the transformer: an <b>encoder</b> and a <b>decoder</b>, each a stack of N identical blocks. The encoder reads the input sentence; the decoder reads the output so far (shifted right) plus the encoder's output, and produces output probabilities. The latest LLMs are <b>decoder-only</b>.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 640 400" width="640" height="400" role="img" aria-label="Transformer encoder and decoder blocks">
  <g class="t-sm">
    <rect x="60" y="120" width="200" height="180" rx="8" class="f-none s-c w15"/><text x="40" y="215" text-anchor="middle" class="t-b">N×</text>
    <rect x="80" y="240" width="160" height="40" rx="4" class="f-vs s-v w1"/><text x="160" y="265" text-anchor="middle">multi-head attention</text>
    <rect x="80" y="205" width="160" height="24" rx="4" class="f-panel s-line w1"/><text x="160" y="222" text-anchor="middle">add &amp; norm</text>
    <rect x="80" y="160" width="160" height="36" rx="4" class="f-cs s-c w1"/><text x="160" y="183" text-anchor="middle">feed forward</text>
    <rect x="80" y="128" width="160" height="24" rx="4" class="f-panel s-line w1"/><text x="160" y="145" text-anchor="middle">add &amp; norm</text>
    <rect x="80" y="330" width="160" height="28" rx="4" class="f-ms s-m w1"/><text x="160" y="349" text-anchor="middle">input embedding</text>
    <circle cx="160" cy="315" r="9" class="f-panel s-line w1"/><text x="160" y="319" text-anchor="middle">+</text><text x="60" y="319" class="t-mut">positional enc.</text>
    <text x="160" y="380" text-anchor="middle" class="t-b">encoder</text>

    <rect x="370" y="60" width="220" height="250" rx="8" class="f-none s-c w15"/><text x="610" y="190" class="t-b">N×</text>
    <rect x="390" y="250" width="180" height="40" rx="4" class="f-vs s-v w1"/><text x="480" y="268" text-anchor="middle">masked multi-head</text><text x="480" y="282" text-anchor="middle">attention</text>
    <rect x="390" y="220" width="180" height="22" rx="4" class="f-panel s-line w1"/><text x="480" y="236" text-anchor="middle">add &amp; norm</text>
    <rect x="390" y="170" width="180" height="40" rx="4" class="f-vs s-v w1"/><text x="480" y="188" text-anchor="middle">multi-head attention</text><text x="480" y="202" text-anchor="middle" class="t-mut">(cross-attention)</text>
    <rect x="390" y="140" width="180" height="22" rx="4" class="f-panel s-line w1"/><text x="480" y="156" text-anchor="middle">add &amp; norm</text>
    <rect x="390" y="98" width="180" height="34" rx="4" class="f-cs s-c w1"/><text x="480" y="120" text-anchor="middle">feed forward</text>
    <rect x="390" y="68" width="180" height="22" rx="4" class="f-panel s-line w1"/><text x="480" y="84" text-anchor="middle">add &amp; norm</text>
    <rect x="390" y="330" width="180" height="28" rx="4" class="f-ms s-m w1"/><text x="480" y="349" text-anchor="middle">output embedding</text>
    <text x="480" y="380" text-anchor="middle" class="t-b">decoder (outputs shifted right)</text>
    <rect x="390" y="10" width="180" height="36" rx="4" class="f-panel s-line w1"/><text x="480" y="33" text-anchor="middle">linear → softmax</text>
    <text x="300" y="168" text-anchor="middle" class="t-c">K, V</text>
  </g>
  <path d="M160 328v-4M160 306v-24M480 328v-36M480 66v-18" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M240 140 C 320 140, 330 190, 388 190" class="f-none s-c w2" marker-end="url(#arr-c)"/>
</svg></div><figcaption>Encoder (left) and decoder (right). The encoder output supplies K and V to the decoder's cross-attention.</figcaption></figure>`
    },
    {
      id: 'embed', title: 'Input embedding and positional encoding',
      html: String.raw`
<p>The sentence is <b>tokenized</b> (not necessarily into whole words), and each token gets an ID from the vocabulary. The same token always gets the same ID:</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Token</th><td>YOUR</td><td>CAT</td><td>IS</td><td>A</td><td>LOVELY</td><td>CAT</td></tr></thead>
<tbody><tr><th>ID</th><td>105</td><td>6587</td><td>5475</td><td>3578</td><td>65</td><td>6587</td></tr></tbody></table></div>
<p>Each ID is mapped to a vector of size <b>d<sub>model</sub> = 512</b>, the <b>embedding</b>. Its numbers represent meaning and are learned parameters; the same word always maps to the same vector.</p>
<p>But word order matters ("I am a good person" vs "Am I a good person"), and nothing so far encodes position. <b>Positional encoding</b> adds a vector that depends <b>only on the position</b>, so the model can treat nearby words as close and distant words as distant. It is not learned:</p>
<div class="formula"><span class="fl">Sinusoidal positional encoding</span><div class="fm">\[ PE(pos, 2i) = \sin\!\left(\frac{pos}{10000^{2i/d_{model}}}\right), \qquad PE(pos, 2i+1) = \cos\!\left(\frac{pos}{10000^{2i/d_{model}}}\right) \]</div><span class="fn">Even dimensions use sin, odd ones cos. Encoder input = embedding + positional encoding (both of size 512).</span></div>
<div data-w="posenc"></div>
<p>"YOUR CAT IS" and "MY DOGS ARE" receive exactly the same positional vectors, so they are computed once and reused.</p>`
    },
    {
      id: 'selfattn', title: 'Self-attention',
      html: String.raw`
<div class="formula"><span class="fl">Scaled dot-product attention</span><div class="fm">\[ \text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^{\top}}{\sqrt{d_k}}\right) V \]</div></div>
<p>For a sequence of 6 tokens with d<sub>model</sub> = 512, take Q = K = V = the input (6 × 512):</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 186" width="700" height="186" role="img" aria-label="Shapes in self-attention: 6 by 512 times 512 by 6 gives 6 by 6, softmax, times 6 by 512 gives 6 by 512">
  <g class="t-sm">
    <rect x="10" y="50" width="120" height="50" class="f-cs s-c w1"/><text x="70" y="80" text-anchor="middle">Q 6×512</text>
    <text x="142" y="80">×</text>
    <rect x="160" y="20" width="50" height="120" class="f-cs s-c w1"/><text x="185" y="84" text-anchor="middle">Kᵀ</text><text x="185" y="156" text-anchor="middle" class="t-mut">512×6</text>
    <text x="222" y="80">=</text>
    <rect x="240" y="50" width="50" height="50" class="f-vs s-v w1"/><text x="265" y="80" text-anchor="middle">6×6</text>
    <text x="350" y="48" text-anchor="middle" class="t-b">softmax</text><text x="350" y="64" text-anchor="middle" class="t-mut">÷√d_k, per row</text>
    <rect x="410" y="50" width="50" height="50" class="f-vs s-v w1"/><text x="435" y="80" text-anchor="middle">6×6</text>
    <text x="472" y="80">×</text>
    <rect x="490" y="50" width="90" height="50" class="f-ms s-m w1"/><text x="535" y="80" text-anchor="middle">V 6×512</text>
    <text x="592" y="80">=</text>
    <rect x="610" y="50" width="80" height="50" class="f-cs s-c w15"/><text x="650" y="80" text-anchor="middle">6×512</text>
    <text x="265" y="178" text-anchor="middle" class="t-mut">6×6: how each word relates to each other word</text>
  </g>
  <path d="M300 75h100" class="s-mut w15" marker-end="url(#arr-mut)"/>
</svg></div><figcaption>Each softmax row sums to 1. Each output row captures a word's meaning (embedding), its position (PE) and its interaction with every other word.</figcaption></figure>
<div data-w="attention"></div>
<div class="grid2">
  <div class="box exam" data-t="Properties to remember"><ul><li><b>Permutation invariant</b>: shuffling words permutes rows and columns but does not change the values (positional encoding is what breaks the tie).</li><li><b>No parameters</b> in self-attention itself.</li><li>Values on the <b>diagonal are usually highest</b>.</li><li>Setting a score to <b>−∞</b> prevents two words interacting, because e<sup>−∞</sup> = 0 after softmax.</li></ul></div>
  <div class="box insight"><p>Self-attention existed before the transformer. The transformer's contribution was <b>multi-head</b> attention, next.</p></div>
</div>`
    },
    {
      id: 'mha', title: 'Multi-head attention',
      html: String.raw`
<div class="formula"><span class="fl">Multi-head attention</span><div class="fm">\[ \text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \dots, \text{head}_h)\, W^{O}, \qquad \text{head}_i = \text{Attention}(Q W_i^{Q},\; K W_i^{K},\; V W_i^{V}) \]</div><span class="fn">W^Q, W^K, W^V (each d_model × d_model) and W^O are trainable.</span></div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 200" width="720" height="200" role="img" aria-label="Q times WQ split into 4 heads of 128, attention per head, concatenate, times WO">
  <g class="t-sm">
    <rect x="10" y="70" width="90" height="50" class="f-cs s-c w1"/><text x="55" y="100" text-anchor="middle">Q seq×512</text>
    <text x="112" y="100">×</text>
    <rect x="128" y="60" width="70" height="70" class="f-vs s-v w1"/><text x="163" y="100" text-anchor="middle">W^Q</text>
    <text x="210" y="100">=</text>
    <g class="s-c w1"><rect x="228" y="70" width="30" height="50" class="f-cs"/><rect x="258" y="70" width="30" height="50" class="f-vs"/><rect x="288" y="70" width="30" height="50" class="f-ms"/><rect x="318" y="70" width="30" height="50" class="f-panel"/></g>
    <text x="288" y="60" text-anchor="middle">Q′ split into h = 4 heads</text><text x="288" y="140" text-anchor="middle" class="t-mut">d_k = 512/4 = 128 each</text>
    <g class="s-line w1"><rect x="400" y="20" width="60" height="30" rx="3" class="f-cs"/><rect x="400" y="60" width="60" height="30" rx="3" class="f-vs"/><rect x="400" y="100" width="60" height="30" rx="3" class="f-ms"/><rect x="400" y="140" width="60" height="30" rx="3" class="f-panel"/></g>
    <text x="430" y="40" text-anchor="middle">head 1</text><text x="430" y="80" text-anchor="middle">head 2</text><text x="430" y="120" text-anchor="middle">head 3</text><text x="430" y="160" text-anchor="middle">head 4</text>
    <text x="430" y="190" text-anchor="middle" class="t-mut">attention per head</text>
    <g class="s-c w1"><rect x="500" y="70" width="30" height="50" class="f-cs"/><rect x="530" y="70" width="30" height="50" class="f-vs"/><rect x="560" y="70" width="30" height="50" class="f-ms"/><rect x="590" y="70" width="30" height="50" class="f-panel"/></g>
    <text x="560" y="60" text-anchor="middle">concat seq×512</text>
    <text x="632" y="100">×</text>
    <rect x="648" y="70" width="50" height="50" class="f-vs s-v w1"/><text x="673" y="100" text-anchor="middle">W^O</text>
  </g>
  <path d="M350 95 L 398 35 M350 95 L 398 75 M350 95 L 398 115 M350 95 L 398 155 M460 35 L 498 90 M460 75 L 498 92 M460 115 L 498 96 M460 155 L 498 100" class="s-mut w1"/>
</svg></div></figure>
<p>Every head sees the <b>full sentence</b> but only a <b>slice of each word's embedding</b>, so each head can learn a different aspect of the words: positive or negative tone, politics or sports, and so on. In the lecture's visualization of 8 heads on "It is in this spirit that a majority of American governments have passed new laws since 2009 making the registration or voting process more difficult", the word <i>making</i> attends strongly to <i>more</i> and <i>difficult</i> in many heads, and weakly to <i>laws</i> in one head.</p>
<h3>Add &amp; Norm</h3>
<p>Each sub-layer is wrapped in a residual add and <b>layer normalization</b>, which is like batch norm but computed <b>per token</b>:</p>
<div class="formula"><span class="fl">Layer normalization</span><div class="fm">\[ \hat{x}_j = \frac{x_j - \mu_j}{\sqrt{\sigma_j^{2} + \epsilon}}, \qquad y_j = \gamma\, \hat{x}_j + \beta \]</div><span class="fn">γ and β are learnable.</span></div>`
    },
    {
      id: 'decoder', title: 'The decoder: masking and cross-attention',
      html: String.raw`
<ul>
<li><b>Output embedding</b>: same as the input embedding.</li>
<li><b>Masked multi-head attention</b>: self-attention over the decoder's inputs, made <b>causal</b>. The output at a position may depend only on earlier positions, so all future scores (the upper triangle) are set to −∞ before softmax. In "Today is Wednesday", <i>Today</i> must not see <i>is</i> or <i>Wednesday</i>.</li>
<li><b>Cross-attention</b>: K and V come from the <b>encoder output</b>, Q from the decoder itself. It is no longer self-attention.</li>
<li><b>Feed-forward</b>: a fully connected layer, then <b>linear + softmax</b> over the vocabulary.</li>
</ul>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 330 250" width="330" height="250" role="img" aria-label="Causal mask: upper triangle set to minus infinity">
  <g class="t-sm">
    <text x="190" y="16" text-anchor="middle" class="t-mut">keys</text>
    <text x="80" y="40" text-anchor="middle" class="t-b">YOUR</text><text x="120" y="40" text-anchor="middle" class="t-b">CAT</text><text x="160" y="40" text-anchor="middle" class="t-b">IS</text><text x="200" y="40" text-anchor="middle" class="t-b">A</text><text x="240" y="40" text-anchor="middle" class="t-b">LOVELY</text><text x="285" y="40" text-anchor="middle" class="t-b">CAT</text>
  </g>
  
  <g class="t-sm t-mono">
    <rect x="60" y="50" width="38" height="30" class="f-c" opacity="0.55"/><rect x="100" y="50" width="38" height="30" class="f-panel"/><rect x="140" y="50" width="38" height="30" class="f-panel"/><rect x="180" y="50" width="38" height="30" class="f-panel"/><rect x="220" y="50" width="38" height="30" class="f-panel"/><rect x="262" y="50" width="38" height="30" class="f-panel"/>
    <rect x="60" y="82" width="38" height="30" class="f-c" opacity="0.55"/><rect x="100" y="82" width="38" height="30" class="f-c" opacity="0.55"/><rect x="140" y="82" width="38" height="30" class="f-panel"/><rect x="180" y="82" width="38" height="30" class="f-panel"/><rect x="220" y="82" width="38" height="30" class="f-panel"/><rect x="262" y="82" width="38" height="30" class="f-panel"/>
    <rect x="60" y="114" width="38" height="30" class="f-c" opacity="0.55"/><rect x="100" y="114" width="38" height="30" class="f-c" opacity="0.55"/><rect x="140" y="114" width="38" height="30" class="f-c" opacity="0.55"/><rect x="180" y="114" width="38" height="30" class="f-panel"/><rect x="220" y="114" width="38" height="30" class="f-panel"/><rect x="262" y="114" width="38" height="30" class="f-panel"/>
    <rect x="60" y="146" width="38" height="30" class="f-c" opacity="0.55"/><rect x="100" y="146" width="38" height="30" class="f-c" opacity="0.55"/><rect x="140" y="146" width="38" height="30" class="f-c" opacity="0.55"/><rect x="180" y="146" width="38" height="30" class="f-c" opacity="0.55"/><rect x="220" y="146" width="38" height="30" class="f-panel"/><rect x="262" y="146" width="38" height="30" class="f-panel"/>
    <rect x="60" y="178" width="38" height="30" class="f-c" opacity="0.55"/><rect x="100" y="178" width="38" height="30" class="f-c" opacity="0.55"/><rect x="140" y="178" width="38" height="30" class="f-c" opacity="0.55"/><rect x="180" y="178" width="38" height="30" class="f-c" opacity="0.55"/><rect x="220" y="178" width="38" height="30" class="f-c" opacity="0.55"/><rect x="262" y="178" width="38" height="30" class="f-panel"/>
    <rect x="60" y="210" width="38" height="30" class="f-c" opacity="0.55"/><rect x="100" y="210" width="38" height="30" class="f-c" opacity="0.55"/><rect x="140" y="210" width="38" height="30" class="f-c" opacity="0.55"/><rect x="180" y="210" width="38" height="30" class="f-c" opacity="0.55"/><rect x="220" y="210" width="38" height="30" class="f-c" opacity="0.55"/><rect x="262" y="210" width="38" height="30" class="f-c" opacity="0.55"/>
    
  </g>
  <g class="t-sm"><text x="54" y="70" text-anchor="end">YOUR</text><text x="54" y="102" text-anchor="end">CAT</text><text x="54" y="134" text-anchor="end">IS</text><text x="54" y="166" text-anchor="end">A</text><text x="54" y="198" text-anchor="end">LOVELY</text><text x="54" y="230" text-anchor="end">CAT</text></g>
</svg></div><figcaption>Grey cells (future positions) are set to −∞ before softmax, so they receive weight 0.</figcaption></figure>`
    },
    {
      id: 'train-infer', title: 'Training in one step, inference one token at a time',
      html: String.raw`
<p>Translate "I love you very much" into Italian "Ti amo molto".</p>
<div class="grid2">
<div class="tile"><h4>Training</h4><ul><li>Encoder input: &lt;SOS&gt; I love you very much &lt;EOS&gt;</li><li>Decoder input: &lt;SOS&gt; Ti amo molto (target shifted right)</li><li>Target: Ti amo molto &lt;EOS&gt;</li><li>Cross-entropy loss, backprop. The mask stops the decoder peeking.</li></ul><p>It all happens in <b>one time step</b>: the whole input and output are processed in parallel on GPUs, unlike an RNN's N sequential steps. This parallelism is why trillion-parameter models became trainable and transformers took over.</p></div>
<div class="tile"><h4>Inference</h4><ul><li>Step 1: decoder input &lt;SOS&gt; → "Ti"</li><li>Step 2: &lt;SOS&gt; Ti → "amo"</li><li>Step 3: &lt;SOS&gt; Ti amo → "molto"</li><li>Step 4: → &lt;EOS&gt;, stop.</li></ul><p>The encoder output is computed <b>once and reused</b>, since the encoder input does not change. The decoder is <b>autoregressive</b>: one token per step.</p></div>
</div>
<div class="box exam"><p>That is why ChatGPT streams its answer word by word: it generates one token at a time. As the output grows the matrices grow, so each new token costs more compute and generation slows down. Real models are huge: a large Qwen model has about 24 decoders, embeddings around 8K wide and a maximum sequence around 16K, which means enormous matrix multiplications. Accelerating this is the topic of the next chapters.</p></div>`
    },
    {
      id: 'linformer', title: 'Linformer: attention in O(n)',
      html: String.raw`
<p>Inside each head, the matrix \(P = \text{softmax}\big(QW_i^{Q}(KW_i^{K})^{\top}/\sqrt{d_k}\big)\) is <b>n × n</b> for sequence length n, so attention costs <b>O(n²)</b>.</p>
<p>Linformer's observation: <b>self-attention is low-rank</b>. Many rows of P are nearly dependent, so an SVD-like approximation loses little. Add projection matrices E<sub>i</sub>, F<sub>i</sub> with k ≪ n that compress the n rows of K and V down to k:</p>
<div class="formula"><span class="fl">Linformer head</span><div class="fm">\[ \text{head}_i = \text{softmax}\!\left(\frac{Q W_i^{Q}\,\big(E_i K W_i^{K}\big)^{\top}}{\sqrt{d_k}}\right) \cdot F_i V W_i^{V} \]</div><span class="fn">The inner matrix is now n × k, so the cost is O(nk). Since k = O(d/ε²) depends on the embedding size d and not on n, attention becomes effectively O(n).</span></div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 600 170" width="600" height="170" role="img" aria-label="Standard n by n attention matrix versus Linformer n by k">
  <g class="t-sm">
    <rect x="30" y="20" width="130" height="130" class="f-ms s-m w15"/><text x="95" y="90" text-anchor="middle" class="t-b">n × n</text><text x="95" y="166" text-anchor="middle" class="t-mut">standard: O(n²)</text>
    <rect x="330" y="20" width="36" height="130" class="f-cs s-c w15"/><text x="348" y="90" text-anchor="middle" class="t-b" transform="rotate(-90 348 90)">n × k</text><text x="348" y="166" text-anchor="middle" class="t-mut">Linformer: O(nk)</text>
    <text x="460" y="70" class="t-mut">E, F project</text><text x="460" y="88" class="t-mut">K, V from n</text><text x="460" y="106" class="t-mut">rows to k rows</text>
  </g>
  <path d="M180 85h130" class="s-mut w15" marker-end="url(#arr-mut)"/>
</svg></div></figure>
<p>Accuracy stays about the same as the vanilla transformer (n = 512 and 1024). The savings grow with n and with smaller k:</p>
<div data-w="bars" data-o='{"title":"Linformer speed-up and memory saving","hint":"Measured in the paper, vs standard attention","unit":"×","labelWidth":200,"max":60,"items":[["n=16384, k=256: time",7.8,"c","7.8×"],["n=16384, k=256: memory",48,"m","48×"],["n=16384, k=2048: time",3.3,"c","3.3×"],["n=16384, k=2048: memory",8,"m","8×"],["n=65536, k=128: time",20,"c","20×"],["n=65536, k=128: memory",60,"m","60×"]]}'></div>
<div data-w="linformer"></div>`
    }
  ],
  takeaways: [
    'RNNs take N sequential steps, suffer vanishing gradients and forget early context; transformers process the whole sequence at once in training.',
    'Embedding (d_model = 512) + sinusoidal positional encoding (sin for even, cos for odd dims; not learned) form the encoder input.',
    'Attention(Q,K,V) = softmax(QKᵀ/√d_k)V; self-attention is permutation invariant, parameter-free, and −∞ blocks interaction.',
    'Multi-head: project with W^Q, W^K, W^V, split d_model into h heads (512/4 = 128), attend, concat, multiply by W^O.',
    'Add & Norm = residual + layer norm per token. Decoder: masked (causal) self-attention, cross-attention with K, V from the encoder.',
    'Training: one parallel step with shifted targets. Inference: autoregressive, one token per step, encoder output reused.',
    'Linformer projects K, V to k rows (k ≪ n) using low rank: O(n²) → O(nk), with up to 20× time and 60× memory savings.'
  ],
  numbers: [
    ['d_model (original transformer)', '512', 'embedding size'],
    ['Head size with h = 4', 'd_k = 128', '512 / 4'],
    ['Attention matrix for 6 tokens', '6 × 6', 'Q (6×512) × Kᵀ (512×6)'],
    ['Large Qwen model', '~24 decoders, ~8K embedding, ~16K max sequence', 'scale of LLM matmuls'],
    ['Linformer, n = 16384, k = 256', '7.8× time, 48× memory', 'savings'],
    ['Linformer, n = 65536, k = 128', '20× time, 60× memory', 'savings']
  ],
  quiz: [
    { q: 'Shape of QKᵀ for 6 tokens with d_model = 512?', o: ['512 × 512', '6 × 512', '6 × 6', '512 × 6'], a: 2, why: '(6 × 512)(512 × 6) = 6 × 6: one score per pair of words.' },
    { q: 'Positional encoding in the original transformer is…', o: ['learned like embeddings', 'a fixed function of position only (sin/cos)', 'random per sentence', 'the token ID'], a: 1, why: 'It is not learned and depends solely on position.' },
    { q: 'For odd dimensions 2i + 1, PE uses…', o: ['sin', 'cos', 'tanh', 'a learned table'], a: 1, why: 'Even dimensions sin, odd dimensions cos.' },
    { q: 'Without positional encoding, shuffling the words of a sentence…', o: ['changes the attention values', 'only permutes rows and columns of the attention matrix', 'has no effect at all', 'breaks softmax'], a: 1, why: 'Self-attention is permutation invariant.' },
    { q: 'With d_model = 512 and h = 8 heads, what is d_k?', num: 64, tol: 0, why: '512 / 8 = 64.' },
    { q: 'In cross-attention, Q comes from… and K, V come from…', o: ['encoder; decoder', 'decoder; encoder', 'decoder; decoder', 'encoder; encoder'], a: 1, why: 'The decoder queries the encoder\'s output.' },
    { q: 'How does masked attention stop the decoder seeing future tokens?', o: ['Deletes them from the input', 'Sets their scores to −∞ before softmax', 'Multiplies V by zero', 'Uses a smaller W^Q'], a: 1, why: 'e^−∞ = 0, so future positions get zero weight.' },
    { q: 'Why can transformers be trained much faster than RNNs?', o: ['They have fewer parameters', 'The whole sequence is processed in one parallel step', 'They do not need backprop', 'They use smaller embeddings'], a: 1, why: 'Teacher forcing with a causal mask lets all positions train at once.' },
    { q: 'During inference, the encoder output is…', o: ['recomputed every token', 'computed once and reused', 'not used', 'fed back as the next input'], a: 1, why: 'The encoder input does not change between decoding steps.' },
    { q: 'Linformer reduces attention cost to…', o: ['O(n²)', 'O(n log n)', 'O(nk), effectively O(n)', 'O(1)'], a: 2, why: 'K and V are projected to k rows with k independent of n.' },
    { q: 'Layer normalization differs from batch norm in that it normalizes…', o: ['across the batch', 'per token, across its features', 'only the weights', 'only during inference'], a: 1, why: 'μ and σ are computed over each token\'s features.' }
  ],
  cards: [
    { f: 'RNN problems', b: 'Sequential (slow), vanishing gradients, weak long-range memory.' },
    { f: 'Positional encoding', b: 'PE(pos,2i) = sin(pos/10000^(2i/d)); PE(pos,2i+1) = cos(…). Fixed, added to embeddings.' },
    { f: 'Self-attention', b: 'softmax(QKᵀ/√d_k)V. Permutation invariant, no parameters, −∞ blocks interaction.' },
    { f: 'Multi-head attention', b: 'Concat(head₁…head_h)W^O, headᵢ = Attention(QWᵢ^Q, KWᵢ^K, VWᵢ^V). Each head sees a slice of the embedding.' },
    { f: 'Add & Norm', b: 'Residual add + layer norm per token: γ(x − μ)/√(σ² + ε) + β.' },
    { f: 'Causal mask', b: 'Upper triangle (future) set to −∞ before softmax in the decoder.' },
    { f: 'Cross-attention', b: 'Q from the decoder; K and V from the encoder output.' },
    { f: 'Training vs inference', b: 'Training: one parallel step, target shifted right. Inference: one token per step, encoder output cached.' },
    { f: 'Linformer', b: 'Low-rank attention: project K, V with E, F to k rows; O(n²) → O(nk).' }
  ]
});

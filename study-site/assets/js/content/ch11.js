CSO.register({
  id: 'ch11', num: 11, part: 'IV', kind: 'comm', span: 5, cover: 'serving',
  coverAlt: 'Streams of request tokens flowing into a row of GPUs, split into a prefill lane and a decode lane.',
  title: 'Serving LLMs: batching, scheduling and disaggregation', short: 'LLM serving',
  lectures: [30, 31, 32, 33, 34],
  summary: 'How a server turns many users\' requests into GPU work. Static vs continuous batching, Orca\'s iteration-level scheduling and selective batching, the latency metrics (TTFT, TBT, goodput), why prefill is compute-bound and decode memory-bound, Sarathi-Serve\'s chunked prefills for stall-free batching, and splitting prefill and decode onto different GPUs (Splitwise, DistServe).',
  sections: [
    {
      id: 'batching', title: 'Why batch, and why static batching wastes the GPU',
      html: String.raw`
<p>Without batching, requests R1–R4 run one after another. With batch size 2, (R1, R2) then (R3, R4) take about half the time: batching exploits the hardware's parallelism.</p>
<p><b>Static batching</b> fixes the batch until every sequence finishes. Sequences end at different times (EOS), so finished slots sit <b>idle</b> until the longest sequence is done and GPU utilization falls. <b>Continuous batching</b> (Orca, OSDI'22) inserts a new sequence the moment one finishes.</p>
<div data-w="batching"></div>
<p>A serving system has two parts: an <b>inference server</b> that schedules (Triton Inference Server, TensorFlow Serving, TorchServe; runs on commodity, highly available hardware such as CPUs) and an <b>execution engine</b> that executes (FasterTransformer, DeepSpeed, Megatron-LM; runs on GPUs).</p>`
    },
    {
      id: 'reqlevel', title: 'Request-level scheduling and its delays',
      html: String.raw`
<p>Lecture example, maximum batch size 3. Requests and their outputs: x1 "I think" → "this idea is bad &lt;eos&gt;" (5 iterations), x2 "I love" → "the asian food &lt;eos&gt;" (4), x3 "my cat is" → "so cute &lt;eos&gt;" (3), x4 "what is" → "your opinion &lt;eos&gt;" (3).</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 170" width="700" height="170" role="img" aria-label="Request-level scheduling: x3 finishes early but its slot stays idle; x4 waits">
  <g class="t-sm">
    <text x="60" y="20" class="t-mut">t1</text><text x="140" y="20" class="t-mut">t2</text><text x="220" y="20" class="t-mut">t3</text><text x="300" y="20" class="t-mut">t4</text><text x="380" y="20" class="t-mut">t5</text><text x="460" y="20" class="t-mut">t6</text>
    <text x="10" y="50" class="t-b">x2</text><text x="10" y="90" class="t-b">x3</text><text x="10" y="130" class="t-b">x4</text>
    <g class="f-cs"><rect x="40" y="34" width="78" height="26" rx="3"/><rect x="120" y="34" width="78" height="26" rx="3"/><rect x="200" y="34" width="78" height="26" rx="3"/><rect x="280" y="34" width="78" height="26" rx="3"/></g>
    <g class="f-cs"><rect x="40" y="74" width="78" height="26" rx="3"/><rect x="120" y="74" width="78" height="26" rx="3"/><rect x="200" y="74" width="78" height="26" rx="3"/></g>
    <rect x="280" y="74" width="78" height="26" rx="3" class="f-panel s-m w1 dash"/><text x="319" y="91" text-anchor="middle" class="t-m">idle</text>
    <rect x="200" y="114" width="158" height="26" rx="3" class="f-panel s-m w1 dash"/><text x="279" y="131" text-anchor="middle" class="t-m">arrived, waiting</text>
    <g class="f-vs"><rect x="360" y="114" width="78" height="26" rx="3"/><rect x="440" y="114" width="78" height="26" rx="3"/><rect x="520" y="114" width="78" height="26" rx="3"/></g>
    <text x="600" y="52" class="t-mut">x2 done at t5</text><text x="610" y="131" class="t-mut">x4 starts late</text>
    <text x="350" y="164" text-anchor="middle" class="t-mut">a new batch is formed only when every request in the current one has finished</text>
  </g>
</svg></div></figure>
<div class="box exam" data-t="Two sources of latency"><ol><li><b>Inactive requests</b>: x3 is done at t4 but its slot stays reserved until x2 finishes at t5.</li><li><b>Late joiners wait</b>: x4 arrives at t3 but cannot start until the whole batch ends.</li></ol></div>`
    },
    {
      id: 'orca', title: 'Orca: iteration-level scheduling and selective batching',
      html: String.raw`
<p>Orca's scheduler and engine share a <b>request pool</b>. The scheduler picks requests for <b>one iteration</b> (one token each); the engine runs that iteration and returns results to the pool. Finished requests return to the user immediately, and new requests join at the next iteration. Requests enter and leave the engine at iteration granularity.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 640 156" width="640" height="156" role="img" aria-label="Orca: request pool, scheduler selects requests for one iteration, engine runs one iteration and returns results">
  <g class="t-sm">
    <rect x="20" y="30" width="150" height="80" rx="6" class="f-panel s-line w1"/><text x="95" y="56" text-anchor="middle" class="t-b">request pool</text><text x="95" y="76" text-anchor="middle" class="t-mut">x1, x2, x3, x4, …</text>
    <rect x="240" y="40" width="130" height="60" rx="6" class="f-vs s-v w1"/><text x="305" y="66" text-anchor="middle" class="t-b">scheduler</text><text x="305" y="84" text-anchor="middle" class="t-mut">pick for 1 iteration</text>
    <rect x="450" y="40" width="160" height="60" rx="6" class="f-cs s-c w1"/><text x="530" y="66" text-anchor="middle" class="t-b">execution engine</text><text x="530" y="84" text-anchor="middle" class="t-mut">run 1 iteration</text>
    <text x="320" y="150" text-anchor="middle" class="t-c">results back to the pool after every iteration; finished requests leave at once</text>
  </g>
  <path d="M170 70h68M370 70h78" class="s-mut w15" marker-end="url(#arr-mut)"/>
  <path d="M530 100 C 530 125, 95 125, 95 112" class="f-none s-c w15" marker-end="url(#arr-c)"/>
</svg></div></figure>
<h3>The batching problem</h3>
<p>Batching needs same-shaped tensors: B requests of [L, H] coalesce into [B, L, H] only if they are in the same phase and the same length. Three cases break this:</p>
<ol><li>Both in prefill with different numbers of input tokens.</li><li>Both in decode but at different token indices.</li><li>One in prefill, one in decode.</li></ol>
<h3>Selective batching</h3>
<p>Most operations do not care which request a token belongs to: <b>Linear (matmul), LayerNorm, Add, GeLU</b>. Orca flattens all tokens into one 2-D tensor [ΣL, H] and batches those. Only <b>attention</b> needs per-request context, so the tensor is split per request, each runs attention with its own K/V (from the attention K/V manager), and the results are merged back.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 190" width="720" height="190" role="img" aria-label="Selective batching: flatten to 7 by H, QKV linear, split for attention, merge, linear">
  <g class="t-sm">
    <rect x="10" y="20" width="60" height="16" class="f-cs"/><rect x="10" y="40" width="60" height="16" class="f-cs"/><rect x="10" y="60" width="60" height="32" class="f-vs"/><rect x="10" y="96" width="60" height="48" class="f-ms"/>
    <text x="78" y="32">x1 [1,H]</text><text x="78" y="52">x2 [1,H]</text><text x="78" y="80">x3 [2,H]</text><text x="78" y="124">x4 [3,H]</text>
    <rect x="150" y="30" width="110" height="110" rx="5" class="f-panel s-line w1"/><text x="205" y="80" text-anchor="middle" class="t-b">QKV Linear</text><text x="205" y="98" text-anchor="middle" class="t-mut">[7,H] → [7,3H]</text>
    <rect x="300" y="20" width="110" height="26" rx="4" class="f-vs s-v w1"/><text x="355" y="38" text-anchor="middle">attention x1</text>
    <rect x="300" y="52" width="110" height="26" rx="4" class="f-vs s-v w1"/><text x="355" y="70" text-anchor="middle">attention x2</text>
    <rect x="300" y="84" width="110" height="26" rx="4" class="f-vs s-v w1"/><text x="355" y="102" text-anchor="middle">attention x3</text>
    <rect x="300" y="116" width="110" height="26" rx="4" class="f-vs s-v w1"/><text x="355" y="134" text-anchor="middle">attention x4</text>
    <rect x="440" y="30" width="80" height="110" rx="5" class="f-panel s-line w1"/><text x="480" y="85" text-anchor="middle">merge [7,H]</text>
    <rect x="550" y="30" width="160" height="110" rx="5" class="f-panel s-line w1"/><text x="630" y="78" text-anchor="middle" class="t-b">Linear, LayerNorm,</text><text x="630" y="96" text-anchor="middle" class="t-b">GeLU, Add</text><text x="630" y="114" text-anchor="middle" class="t-mut">batched on [7,H]</text>
    <text x="355" y="170" text-anchor="middle" class="t-v">split: needs each request's own K/V</text>
    <text x="205" y="170" text-anchor="middle" class="t-c">batched</text><text x="630" y="170" text-anchor="middle" class="t-c">batched</text>
  </g>
  <path d="M130 85h18M260 85 L 298 33 M260 85 L 298 65 M260 85 L 298 97 M260 85 L 298 129 M410 33 L 438 80 M410 65 L 438 84 M410 97 L 438 88 M410 129 L 438 92 M520 85h28" class="s-mut w1" marker-end="url(#arr-mut)"/>
</svg></div></figure>
<h3>Memory and deadlock</h3>
<p>If requests grow without reservation (iteration 1: "my cat is" + "so"; iteration 2: "I" + "like"), GPU memory can run out <b>mid-generation</b> and nobody can finish: <b>deadlock</b>. Orca reserves enough space for all iterations at the first iteration, using a predetermined <b>max_tokens</b> (say 5). Orca predates PagedAttention, so it inherits the pre-allocation drawbacks of chapter 10. With dynamic allocation deadlocks can still happen, and vLLM resolves them by <b>recomputing or swapping</b>: move some requests' KV to CPU DRAM, then bring it back to HBM to finish decoding.</p>
<p>Orca beats FasterTransformer with lower latency at the same throughput across model sizes. Its lasting contribution is the primitives for iteration-level scheduling. Open question: how do we meet <b>latency SLOs</b> while raising throughput?</p>`
    },
    {
      id: 'metrics', title: 'Latency metrics: TTFT, TBT and goodput',
      html: String.raw`
<div class="grid2">
  <div class="formula"><span class="fl">Time to first token</span><div class="fm">\[ \text{TTFT} = \text{scheduling delay} + \text{prefill time} \]</div></div>
  <div class="formula"><span class="fl">Time between tokens</span><div class="fm">\[ \text{TBT (TPOT)} = \text{average gap between consecutive output tokens} \]</div></div>
</div>
<div class="grid2">
  <div class="tile"><h4>Chatbot</h4><p>Needs a fast first response, and tokens at least as fast as a human reads: P99 TBT = 250 ms.</p></div>
  <div class="tile"><h4>Summarization</h4><p>The user tolerates a longer first response, but the output should stream fast: P99 = 35 ms.</p></div>
</div>
<div class="formula"><span class="fl">Throughput vs goodput</span><div class="fm">\[ \text{throughput} = \frac{\text{completed requests}}{\text{time}}, \qquad \text{goodput} = \frac{\text{completed requests that meet the SLO}}{\text{time}} \]</div><span class="fn">A system can complete 10 requests/s but, with SLO TTFT &lt; 200 ms and TPOT &lt; 50 ms, only 3 requests/s meet it. High throughput with low goodput means poor user experience.</span></div>`
    },
    {
      id: 'roofline', title: 'Prefill is compute-bound, decode is memory-bound',
      html: String.raw`
<div class="grid2">
  <div class="tile"><h4>Prefill: excess parallelism</h4><p>A prompt can have thousands of tokens. Beyond about <b>512 tokens</b>, a longer prompt raises latency but not throughput (tokens/s saturates): the GPU's compute is full. <b>Compute-bound.</b></p></div>
  <div class="tile"><h4>Decode: too little parallelism</h4><p>One token per request, and the latency is almost entirely the time to <b>read the weights</b>. Raising the batch from 1 to 32 lifts throughput from about 100 to 1500+ tokens/s while latency barely moves (about 18 → 20 ms). <b>Memory-bound.</b></p></div>
</div>
<p>The roofline model explains this. <b>Arithmetic intensity</b> is FLOPs per byte of memory accessed. Below the "ridge" a kernel is memory-bound and its speed grows with intensity; above it, the compute roof caps it.</p>
<div class="formula"><span class="fl">Roofline</span><div class="fm">\[ \text{attainable FLOP/s} = \min\big(\text{peak FLOP/s},\; \text{memory bandwidth} \times \text{arithmetic intensity}\big), \qquad \text{intensity} = \frac{\text{FLOPs}}{\text{bytes accessed}} \]</div></div>
<div data-w="roofline"></div>
<p>A decode step does 1 × d work per token but must fetch all the weights (plus a growing KV cache): low intensity. A prefill of N tokens does N × d work with the same weights and no KV fetch: high intensity. So <b>batching is essential for decode throughput</b>, and decode leaves compute idle, a slack that can be filled.</p>`
    },
    {
      id: 'sched', title: 'The scheduling dilemma',
      html: String.raw`
<p>Every request needs a prefill first, so a server must interleave prefills with ongoing decodes. Suppose C exits and D, E arrive while A and B are decoding:</p>
<div class="grid2">
  <div class="box exam" data-t="Prefill-prioritizing (vLLM, Orca)"><p>Run Dp, Ep first while A and B's decodes <b>stall</b>, or mix them into one long iteration. Either way TBT spikes: <b>high throughput, high TBT</b>.</p></div>
  <div class="box exam" data-t="Decode-prioritizing (FasterTransformer)"><p>Keep decoding A and B until they exit, then prefill D and E. Decodes run at small batch sizes: <b>low TBT, low throughput</b>.</p></div>
</div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 520 220" width="520" height="220" role="img" aria-label="Throughput versus TBT latency for different schedulers">
  <line x1="60" y1="180" x2="490" y2="180" class="s-line w1"/><line x1="60" y1="180" x2="60" y2="20" class="s-line w1"/>
  <g class="t-sm">
    <text x="275" y="208" text-anchor="middle" class="t-mut">TBT latency → (lower is better)</text>
    <text x="24" y="100" text-anchor="middle" class="t-mut" transform="rotate(-90 24 100)">throughput (QPS) →</text>
    <circle cx="110" cy="150" r="8" class="f-v"/><text x="124" y="154">FasterTransformer (decode-prioritizing)</text>
    <circle cx="420" cy="50" r="8" class="f-m"/><text x="432" y="78" text-anchor="end">vLLM, Orca (prefill-prioritizing)</text>
    <circle cx="270" cy="100" r="8" class="f-mut"/><text x="284" y="104">LightLLM (dynamic priority)</text>
    <circle cx="110" cy="50" r="9" class="f-c"/><text x="124" y="54" class="t-c t-b">ideal: high throughput, low TBT</text>
  </g>
</svg></div></figure>
<p>Question: can a new request's prefill run <b>without pausing ongoing decodes</b> and without giving up throughput?</p>`
    },
    {
      id: 'sarathi', title: 'Sarathi-Serve: chunked prefills and stall-free batching',
      html: String.raw`
<p>Example: Mistral-7B on an A100 with a decode SLO of 10 ms. Request A is decoding (8 ms per iteration) when B arrives with a long prompt.</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Policy</th><th>What runs</th><th>A's next token</th></tr></thead>
<tbody>
<tr><td>vLLM</td><td>A_D, then B's full prefill, then A_D + B_D</td><td>24 ms (TBT 16 ms): SLO violated</td></tr>
<tr><td>Mixed batch</td><td>A_D + full B_P together</td><td>16 ms: still violated</td></tr>
<tr><td><b>Sarathi-Serve</b></td><td>A_D + B_P1 (a chunk), then A_D + B_P2, …</td><td><b>9 ms ≤ 10 ms</b>, and B keeps progressing</td></tr>
</tbody></table></div>
<div class="box insight" data-t="Key insight"><p><b>Chunked prefills</b>: split a long prefill into chunks just big enough to use the <b>leftover compute</b> of a memory-bound decode batch. The decode's low arithmetic intensity means a prefill chunk can piggyback with negligible extra latency. Decode batches move up toward the roofline knee and prefill batches move down to it.</p></div>
<div data-w="stallfree"></div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 720 150" width="720" height="150" role="img" aria-label="Baseline schedule with bubbles vs Sarathi decode-maximal batches of equal width">
  <g class="t-sm">
    <text x="10" y="30" class="t-b">baseline</text>
    <g class="f-v"><rect x="110" y="14" width="90" height="26" rx="3"/><rect x="202" y="14" width="120" height="26" rx="3"/><rect x="324" y="14" width="70" height="26" rx="3"/><rect x="396" y="14" width="90" height="26" rx="3"/></g>
    <text x="155" y="31" text-anchor="middle" class="t-inv">Ap</text><text x="262" y="31" text-anchor="middle" class="t-inv">Bp</text><text x="359" y="31" text-anchor="middle" class="t-inv">Cp</text><text x="441" y="31" text-anchor="middle" class="t-inv">Dp</text>
    <g class="f-c"><rect x="488" y="14" width="30" height="26" rx="3"/><rect x="520" y="14" width="30" height="26" rx="3"/><rect x="552" y="14" width="30" height="26" rx="3"/></g>
    <text x="600" y="31" class="t-mut">uneven, stalls</text>
    <text x="10" y="90" class="t-b">Sarathi</text>
    <g class="s-line w1">
      <rect x="110" y="74" width="60" height="26" rx="3" class="f-v"/><rect x="172" y="74" width="60" height="26" rx="3" class="f-v"/><rect x="234" y="74" width="60" height="26" rx="3" class="f-v"/><rect x="296" y="74" width="60" height="26" rx="3" class="f-v"/>
      <rect x="358" y="74" width="45" height="26" rx="3" class="f-v"/><rect x="403" y="74" width="15" height="26" rx="3" class="f-c"/>
      <rect x="420" y="74" width="45" height="26" rx="3" class="f-v"/><rect x="465" y="74" width="15" height="26" rx="3" class="f-c"/>
      <rect x="482" y="74" width="45" height="26" rx="3" class="f-v"/><rect x="527" y="74" width="15" height="26" rx="3" class="f-c"/>
    </g>
    <text x="140" y="91" text-anchor="middle" class="t-inv">Ap1</text><text x="202" y="91" text-anchor="middle" class="t-inv">Bp1</text><text x="264" y="91" text-anchor="middle" class="t-inv">Ap2</text><text x="326" y="91" text-anchor="middle" class="t-inv">Bp2</text><text x="380" y="91" text-anchor="middle" class="t-inv">Cp1</text><text x="442" y="91" text-anchor="middle" class="t-inv">Bp3</text><text x="504" y="91" text-anchor="middle" class="t-inv">Dp1</text>
    <text x="560" y="91" class="t-mut">+ decodes</text>
    <text x="360" y="132" text-anchor="middle" class="t-mut">every batch has the same width (fills the GPU); violet = prefill chunk, teal = piggybacked decode</text>
  </g>
</svg></div><figcaption>Decode-maximal batching with chunked prefills: no stalls, and later requests reach their first decode sooner.</figcaption></figure>
<h3>Picking the chunk size</h3>
<p>Pick the chunk that meets the TBT target; bigger is not always better. GPU matmuls suffer <b>tile quantization</b>: if a dimension is not a multiple of the tile size, extra work is done, so iteration time is step-like in sequence length. Per-token cost: chunk 128 → <b>0.43 µs</b>, 256 → <b>0.27 µs</b>, 257 → <b>0.36 µs</b>. So make each chunk a multiple of the tile size (the largest chunk on a step).</p>
<h3>Results and limits</h3>
<p>On ShareGPT4 traces on A100s with strict and relaxed SLOs (Llama-2 70B, Falcon 180B), Sarathi-Serve has <b>5–6× higher serving capacity</b> under SLO than Orca or vLLM, adapting by choosing different chunk sizes. In the demo, vLLM's tokens/s shows flat prefill-only gaps and sudden drops while Sarathi stays steady, finishing a batch in about 40 s instead of 50 s (about 20% better), with the same model. Summary: SOTA systems sacrificed decode latency for throughput; decode's low intensity lets prefills piggyback; result: up to 6× capacity, adopted by all major serving frameworks (from Microsoft Research India).</p>
<div class="box exam" data-t="Is it perfect? No."><ul><li>Smaller chunks give lower TBT but more chunking overhead (512 &gt; 1024 &gt; 2048) and lower prefill throughput.</li><li>Prefill and decode behave differently: prefill throughput barely rises with batch size, decode throughput rises a lot.</li><li>Co-locating them causes <b>interference</b> that grows with more requests.</li><li>Over-provisioning to meet SLOs is costly: with TTFT SLO 200 ms and TPOT SLO 50 ms, 1 GPU satisfies 3 of 10 requests; 4 GPUs satisfy all, at 4× the cost.</li></ul></div>`
    },
    {
      id: 'disagg', title: 'Disaggregation: Splitwise and DistServe',
      html: String.raw`
<p>Prefill and decode prefer different things. For "Which is better, pizza or burger?" → "Pizza is better.":</p>
<div class="grid2">
  <div class="tile"><h4>Prompt (prefill) phase</h4><p>Produces the first token. <b>Compute- and power-intensive</b>, gains little from batching, prefers tensor (intra-op) parallelism to keep TTFT tight.</p></div>
  <div class="tile"><h4>Token (decode) phase</h4><p>Produces the rest. <b>Memory-intensive</b> (weights + KV cache), gains a lot from batching.</p></div>
</div>
<p>Running both on the same GPUs is inefficient (coupled parallelism, interference). <b>Splitwise</b> and <b>DistServe</b> put them on different servers: a <b>prompt server</b> with small batches at maximum power, and a <b>token server</b> with large batches, power-capped. Each can even use different hardware.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 700 170" width="700" height="170" role="img" aria-label="Prompt GPUs ship KV cache layer by layer to token GPUs over InfiniBand">
  <g class="t-sm">
    <rect x="20" y="30" width="200" height="110" rx="8" class="f-vs s-v w15"/><text x="120" y="56" text-anchor="middle" class="t-b">prompt server</text><text x="120" y="74" text-anchor="middle" class="t-mut">small batches, max power</text>
    <g class="f-panel s-line w1"><rect x="40" y="90" width="36" height="36" rx="3"/><rect x="84" y="90" width="36" height="36" rx="3"/><rect x="128" y="90" width="36" height="36" rx="3"/><rect x="172" y="90" width="36" height="36" rx="3"/></g>
    <rect x="480" y="30" width="200" height="110" rx="8" class="f-cs s-c w15"/><text x="580" y="56" text-anchor="middle" class="t-b">token server</text><text x="580" y="74" text-anchor="middle" class="t-mut">large batches, power-capped</text>
    <g class="f-panel s-line w1"><rect x="500" y="90" width="36" height="36" rx="3"/><rect x="544" y="90" width="36" height="36" rx="3"/><rect x="588" y="90" width="36" height="36" rx="3"/><rect x="632" y="90" width="36" height="36" rx="3"/></g>
    <text x="350" y="56" text-anchor="middle" class="t-m t-b">KV cache transfer</text><text x="350" y="74" text-anchor="middle" class="t-mut">InfiniBand, 4 × 25 GB/s</text>
    <text x="350" y="156" text-anchor="middle" class="t-mut">KV1, KV2, … shipped layer by layer while the prompt phase continues</text>
  </g>
  <path d="M222 100h256M222 112h256M222 124h256" class="s-m w15 dash" marker-end="url(#arr-m)"/>
</svg></div></figure>
<ul>
<li>Splitting needs a fast <b>KV-cache transfer</b> from prompt GPUs to token GPUs (Splitwise uses GPU InfiniBand).</li>
<li>Transfers are parallelized: with 4-way tensor parallelism each GPU holds 1/4 of the KV cache, and 4 × 25 GB/s = <b>100 GB/s</b>.</li>
<li>KV caches can reach hundreds of GB, so TTFT = prompt phase + transfer. Splitwise <b>overlaps</b> the transfer with the prompt phase: each layer's KV is independent, so shipping starts after the first layer, leaving only a small residual delay.</li>
</ul>
<h3>Why disaggregation raises goodput (DistServe, OSDI 2024)</h3>
<div class="box paper" data-t="Lecture example"><p>One GPU running prefill alone meets the P90 TTFT SLO (400 ms) up to <b>5.6 rps</b>; running decode alone meets its SLO up to <b>10 rps</b>. Co-located on one GPU, interference drops the goodput to <b>1.6 rps</b>.</p><p>With 2 prefill GPUs + 1 decode GPU (2P1D): goodput = min(5.6 × 2, 10) = 10 rps on 3 GPUs = <b>3.3 rps per GPU</b>, about <b>2× per GPU</b> (3× the hardware, about 6× the total: 1.6 → 10 rps).</p></div>
<div data-w="bars" data-o='{"title":"DistServe vs vanilla vLLM","hint":"Requests served within SLO per GPU","unit":"×","labelWidth":170,"max":5,"items":[["Chatbot",3.4,"c","2.0–3.4×"],["Code completion",3.2,"c","3.2×"],["Summarization",4.5,"c","4.5×"]]}'></div>`
    }
  ],
  takeaways: [
    'Static batching idles finished slots; continuous (iteration-level) batching swaps requests in and out every iteration (Orca).',
    'Request-level scheduling delays come from inactive requests and late joiners waiting for the whole batch.',
    'Selective batching flattens tokens to [ΣL, H] for Linear/LayerNorm/GeLU/Add and splits only for attention.',
    'Orca avoids mid-generation deadlock by reserving max_tokens up front; vLLM swaps or recomputes instead.',
    'TTFT = scheduling delay + prefill; TBT = gap between tokens; goodput counts only requests meeting the SLO.',
    'Prefill is compute-bound (saturates beyond ~512 tokens); decode is memory-bound (batching raises throughput, not latency).',
    'Sarathi-Serve chunks prefills to fill decode batches without stalls: 9 ms vs 24 ms for A\'s next token, 5–6× capacity under SLO.',
    'Splitwise/DistServe disaggregate prefill and decode onto different GPUs, shipping KV cache layer by layer; ~2× goodput per GPU.'
  ],
  numbers: [
    ['Prefill throughput saturates at', '~512 prompt tokens', 'compute-bound'],
    ['Decode batch 1 → 32', '~100 → 1500+ tokens/s', 'latency ~18 → 20 ms'],
    ['Chatbot P99 TBT', '250 ms', 'human reading speed'],
    ['Summarization P99', '35 ms', ''],
    ['Mistral-7B example (SLO 10 ms)', 'vLLM 24 ms, mixed 16 ms, Sarathi 9 ms', 'A\'s next token'],
    ['Chunk per-token cost', '128: 0.43 µs, 256: 0.27 µs, 257: 0.36 µs', 'tile quantization'],
    ['Sarathi-Serve capacity', '5–6× under SLO', 'vs Orca and vLLM'],
    ['KV transfer bandwidth', '4 × 25 = 100 GB/s', '4-way tensor parallel'],
    ['DistServe example', '1.6 → 3.3 rps per GPU', '2P1D'],
    ['DistServe vs vLLM', '2.0–4.48× within SLO', 'chatbot, code, summarization']
  ],
  quiz: [
    { q: 'Why does static batching waste GPU time?', o: ['It cannot batch prefills', 'Finished sequences leave idle slots until the longest finishes', 'It uses too much memory', 'It reorders tokens'], a: 1, why: 'The batch is fixed until every sequence ends.' },
    { q: 'At what granularity does Orca schedule?', o: ['Request', 'Iteration (one token per request)', 'Layer', 'Epoch'], a: 1, why: 'Requests can enter and leave after every iteration.' },
    { q: 'Which operation must be split per request in selective batching?', o: ['Linear', 'LayerNorm', 'Attention', 'GeLU'], a: 2, why: 'Attention needs each request\'s own K/V; the others are token-wise.' },
    { q: 'How does Orca avoid running out of memory mid-generation?', o: ['Swapping to SSD', 'Reserving space for max_tokens at the first iteration', 'Paged blocks', 'Recomputing weights'], a: 1, why: 'It pre-allocates, which inherits fragmentation drawbacks.' },
    { q: 'TTFT equals…', o: ['decode time × tokens', 'scheduling delay + prefill time', 'TBT × 2', 'network latency only'], a: 1, why: 'The first token appears after waiting and the prefill pass.' },
    { q: 'A server completes 10 rps but only 3 rps meet the SLO. Its goodput is…', num: 3, tol: 0, why: 'Goodput counts only SLO-satisfying completions.' },
    { q: 'Decode is memory-bound because…', o: ['it uses FP32', 'each token needs all weights fetched but does little compute', 'the KV cache is on CPU', 'attention is quadratic'], a: 1, why: 'Low arithmetic intensity: 1 × d work per weight fetch.' },
    { q: 'Increasing decode batch size from 1 to 32 mostly increases…', o: ['latency', 'throughput', 'TTFT', 'model size'], a: 1, why: 'About 100 → 1500+ tokens/s with latency ~18 → 20 ms.' },
    { q: 'Sarathi-Serve\'s key mechanism is…', o: ['speculative decoding', 'chunked prefills piggybacked on decode batches', 'KV quantization', 'disaggregation'], a: 1, why: 'Chunks use the leftover compute of memory-bound decodes.' },
    { q: 'Why should a prefill chunk be a multiple of the GPU tile size?', o: ['To align memory pages', 'Tile quantization: 257 tokens cost more per token than 256', 'To simplify attention', 'To fit in L1'], a: 1, why: '0.27 µs/token at 256 vs 0.36 µs at 257.' },
    { q: 'With prefill alone at 5.6 rps and decode alone at 10 rps per GPU, the 2P1D goodput per GPU is about…', num: 3.3, tol: 0.05, why: 'min(2 × 5.6, 10) / 3 = 10 / 3 ≈ 3.3.' },
    { q: 'How does Splitwise hide KV-cache transfer time?', o: ['Compresses KV with RLC', 'Ships each layer\'s KV as soon as it is computed, overlapping the prompt phase', 'Keeps KV on the prompt GPU', 'Uses CPU memory'], a: 1, why: 'Layer-wise KV is independent, so transfer starts after the first layer.' }
  ],
  cards: [
    { f: 'Continuous batching', b: 'Insert a new sequence as soon as one finishes (iteration-level scheduling, Orca).' },
    { f: 'Selective batching', b: 'Flatten tokens [ΣL, H] for Linear/LayerNorm/Add/GeLU; split per request only for attention.' },
    { f: 'Orca deadlock fix', b: 'Reserve KV space for max_tokens up front. vLLM instead swaps to CPU or recomputes.' },
    { f: 'TTFT / TBT', b: 'TTFT = scheduling delay + prefill. TBT (TPOT) = average time between output tokens.' },
    { f: 'Goodput', b: 'Completed requests that meet the SLO per unit time.' },
    { f: 'Prefill vs decode boundness', b: 'Prefill: compute-bound (high intensity). Decode: memory-bound (weights fetched per token).' },
    { f: 'Roofline', b: 'Attainable = min(peak, bandwidth × FLOPs/byte).' },
    { f: 'Prefill- vs decode-prioritizing', b: 'vLLM/Orca: high throughput, high TBT. FasterTransformer: low TBT, low throughput.' },
    { f: 'Sarathi-Serve', b: 'Chunked prefills + decode-maximal batching = stall-free; up to 6× capacity under SLO.' },
    { f: 'Disaggregation', b: 'Prefill on prompt GPUs, decode on token GPUs; KV shipped layer by layer; ~2× goodput per GPU (DistServe).' }
  ]
});

CSO.register({
  id: 'ch12', num: 12, part: 'V', kind: 'memory', span: 3, cover: 'checkpoint',
  coverAlt: 'A training timeline with glowing save points where model weights stream from GPU to disk.',
  title: 'Fault-tolerant training: checkpointing', short: 'Checkpointing',
  lectures: [35, 36, 37],
  summary: 'Long training jobs crash, get pre-empted and migrate, so their weights must be saved often without slowing training. CheckFreq makes fine-grained checkpoints cheap with pipelined snapshots, a resumable data iterator and adaptive frequency. Check-N-Run shrinks checkpoints of huge recommendation models with differential and quantized checkpoints.',
  sections: [
    {
      id: 'why', title: 'Why checkpoint?',
      html: String.raw`
<p>Training loops over mini-batches (forward, backward, weight update) for many epochs. It is compute-intensive and slow: Llama-70B might train for 5 days, and a crash on day 4 is a disaster. Any interruption wipes the learned parameters held in memory:</p>
<ul><li>VM migration, expiry or crash;</li><li>job migration in shared GPU clusters;</li><li>pre-emption of cheap <b>spot VMs</b>.</li></ul>
<p>Restarting from scratch wastes GPU cycles. So the parameters are written to <b>persistent storage</b> every so often, and after a failure training resumes from the latest checkpoint. Real cluster data shows the share of failed jobs climbing quickly with time-to-failure.</p>
<div class="grid2">
<div class="box insight" data-t="Checkpoints are also used for"><ul><li>failure recovery (guaranteeing progress)</li><li>migrating training jobs</li><li>publishing snapshots (e.g. every 50th epoch)</li><li>transfer learning</li></ul></div>
<div class="box exam" data-t="What was wrong before CheckFreq (FAST'21)"><ul><li><b>Synchronous checkpoints</b> halt training while tens of GB are saved: large <b>checkpoint stalls</b>.</li><li><b>Manual frequency</b>, usually at epoch boundaries. But epochs keep getting longer (bigger models and datasets) and interruptions more frequent (spot VMs), so we need <b>fine-grained, iteration-level</b> checkpoints.</li></ul></div>
</div>`
    },
    {
      id: 'checkfreq', title: 'CheckFreq: policy and mechanism',
      html: String.raw`
<p>Fine-grained checkpointing raises three questions: a <b>policy</b> question (how often?) and two <b>mechanism</b> questions (how to keep the cost low? how to resume correctly?).</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th></th><th>Challenge</th><th>CheckFreq's answer</th></tr></thead>
<tbody>
<tr><td rowspan="2">Mechanism</td><td>Checkpoint stalls</td><td><b>Two-phase, DNN-aware checkpointing</b> (pipelined snapshot + persist)</td></tr>
<tr><td>Data invariant</td><td><b>Resumable data iterator</b></td></tr>
<tr><td>Policy</td><td>Checkpoint frequency</td><td><b>Systematic online profiling</b> for the initial frequency + <b>adaptive rate tuning</b> for interference</td></tr>
</tbody></table></div>
<h3>Two phases: snapshot() and persist()</h3>
<p>A checkpoint = <b>snapshot()</b> (copy the weights GPU → CPU memory) + <b>persist()</b> (write CPU memory → disk). With a policy of checkpointing every three iterations:</p>
<ol type="a">
<li><b>Synchronous</b>: training halts during both: a big stall.</li>
<li><b>Persist pipelined</b>: once the snapshot is in CPU memory, training resumes while the disk write happens in the background (the GPU weights can change because a copy already exists). Smaller stall.</li>
<li><b>Snapshot and persist pipelined</b>: the next iteration's forward and backward run <b>during</b> the snapshot; only its <b>weight update</b> waits for the snapshot to finish, otherwise the checkpoint would mix old and new weights. Minimal stall.</li>
</ol>
<div data-w="ckpt"></div>
<p><b>GPU-optimized snapshots</b>: serializing and snapshotting on the GPU can be up to <b>10× cheaper</b>. If profiling finds spare GPU memory, CheckFreq snapshots into an extra copy in GPU memory and writes to CPU memory asynchronously; if GPU memory is full, it falls back to pipelined CPU-side snapshots.</p>`
    },
    {
      id: 'iterator', title: 'Resuming correctly: the resumable data iterator',
      html: String.raw`
<p>The data iterator must keep the invariant that <b>each epoch sees every item exactly once, in shuffled order</b>.</p>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 680 170" width="680" height="170" role="img" aria-label="Naive restart reshuffles and repeats items; resumable iterator continues with the remaining items">
  <g class="t-sm t-mono">
    <text x="10" y="30" class="t-b t-ui">epoch order</text>
    <g class="f-cs s-c w1"><rect x="150" y="12" width="40" height="28" rx="3"/><rect x="194" y="12" width="40" height="28" rx="3"/><rect x="238" y="12" width="40" height="28" rx="3"/><rect x="282" y="12" width="40" height="28" rx="3"/></g>
    <g class="f-panel s-line w1"><rect x="326" y="12" width="40" height="28" rx="3"/><rect x="370" y="12" width="40" height="28" rx="3"/><rect x="414" y="12" width="40" height="28" rx="3"/><rect x="458" y="12" width="40" height="28" rx="3"/></g>
    <text x="170" y="31" text-anchor="middle">1</text><text x="214" y="31" text-anchor="middle">5</text><text x="258" y="31" text-anchor="middle">8</text><text x="302" y="31" text-anchor="middle">2</text><text x="346" y="31" text-anchor="middle">6</text><text x="390" y="31" text-anchor="middle">4</text><text x="434" y="31" text-anchor="middle">7</text><text x="478" y="31" text-anchor="middle">3</text>
    <text x="332" y="60" class="t-m t-ui">✕ crash</text>
    <text x="10" y="94" class="t-ui">naive restart</text>
    <g class="f-ms s-m w1"><rect x="326" y="76" width="40" height="28" rx="3"/><rect x="370" y="76" width="40" height="28" rx="3"/><rect x="414" y="76" width="40" height="28" rx="3"/><rect x="458" y="76" width="40" height="28" rx="3"/></g>
    <text x="346" y="95" text-anchor="middle">4</text><text x="390" y="95" text-anchor="middle">2</text><text x="434" y="95" text-anchor="middle">1</text><text x="478" y="95" text-anchor="middle">5</text>
    <text x="510" y="95" class="t-m t-ui">repeats 1, 2, 5</text>
    <text x="10" y="144" class="t-ui">CheckFreq</text>
    <g class="f-cs s-c w1"><rect x="326" y="126" width="40" height="28" rx="3"/><rect x="370" y="126" width="40" height="28" rx="3"/><rect x="414" y="126" width="40" height="28" rx="3"/><rect x="458" y="126" width="40" height="28" rx="3"/></g>
    <text x="346" y="145" text-anchor="middle">6</text><text x="390" y="145" text-anchor="middle">4</text><text x="434" y="145" text-anchor="middle">7</text><text x="478" y="145" text-anchor="middle">3</text>
    <text x="510" y="145" class="t-c t-ui">seed + items consumed</text>
  </g>
  <line x1="324" y1="8" x2="324" y2="160" class="s-m w15 dash"/>
</svg></div><figcaption>After a crash following items 1, 5, 8, 2, a naive restart reshuffles and may train 4, 2, 1, 5. CheckFreq stores the random seed and the number of items consumed, so it resumes with 6, 4, 7, 3.</figcaption></figure>
<p>With the resumable iterator, the top-1 accuracy curve after an interruption matches the no-interruption curve; the naive restart ends lower.</p>
<p><b>Adaptive rate tuning</b>: the job's environment can change (other jobs introduce interference), so a background process keeps estimating and adjusting the checkpoint frequency.</p>`
    },
    {
      id: 'results', title: 'CheckFreq results',
      html: String.raw`
<ul>
<li>Iteration-time traces: synchronous checkpointing shows big spikes; pipelining only persist() (async IO) halves the cost but still stalls; CheckFreq pipelines carefully with compute and removes most of the stall.</li>
<li>Checkpointing at CheckFreq's chosen frequency with the baseline mechanism would add <b>20–70%</b> to training time (ResNet-50, ResNeXt, ResNet-18, Inception, VGG-16, DenseNet, BERT). CheckFreq keeps the overhead at <b>about 3.5% or less</b>.</li>
</ul>
<div data-w="bars" data-o='{"title":"Recovery time after a failure","hint":"Epoch-based checkpointing (copper) vs CheckFreq (teal), seconds","unit":" s","labelWidth":170,"max":7100,"items":[["ResNet-18 epoch-based",840,"m","840 s"],["ResNet-18 CheckFreq",5,"c","5 s"],["ResNet-50 epoch-based",2100,"m","2100 s"],["ResNet-50 CheckFreq",24,"c","24 s"],["VGG-16 epoch-based",5700,"m","5700 s"],["VGG-16 CheckFreq",25,"c","25 s"],["ResNeXt epoch-based",7080,"m","7080 s"],["ResNeXt CheckFreq",32,"c","32 s"],["DenseNet epoch-based",2340,"m","2340 s"],["DenseNet CheckFreq",7,"c","7 s"],["Inception epoch-based",3000,"m","3000 s"],["Inception CheckFreq",27,"c","27 s"],["BERT epoch-based",4920,"m","4920 s"],["BERT CheckFreq",85,"c","85 s"]],"note":"Recovery drops from hours to seconds, because far less work is lost since the last checkpoint."}'></div>`
    },
    {
      id: 'checknrun', title: 'Check-N-Run: checkpoints for huge recommendation models',
      html: String.raw`
<p>Recommendation models (Check-N-Run, NSDI'22) are enormous, mostly embedding tables. Checkpointing them needs <b>high write bandwidth</b> and <b>large storage capacity</b>. Two techniques:</p>
<div class="grid2">
  <div class="tile"><h4>Differential checkpointing</h4><p>Reduces <b>write bandwidth</b>.</p></div>
  <div class="tile"><h4>Quantized checkpoints</h4><p>Reduce <b>checkpoint size</b>.</p></div>
</div>
<h3>Differential checkpointing</h3>
<p>Recommender models have lots of sparse features, so each iteration modifies only a <b>small part</b> of the parameters (rows of the embedding tables). Over 10-, 20-, 30- and 60-minute intervals only about 10–35% of the model changes. So: take one full <b>baseline checkpoint</b>, track every modified vector, and store only the vectors changed since the baseline.</p>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Approach</th><th>Stores</th><th>Drawback</th></tr></thead>
<tbody>
<tr><td><b>One-shot differential</b></td><td>changes since the single baseline</td><td>each checkpoint grows over time</td></tr>
<tr><td><b>Consecutive incremental</b></td><td>changes since the <i>last</i> checkpoint</td><td>must keep every increment and apply them recursively on recovery, moving all of them from remote storage (bandwidth); storage grows without bound (~400% of model size in the plot)</td></tr>
<tr><td><b>Intermittent differential</b></td><td>a fresh full snapshot at intervals, differentials in between</td><td>none major: at each interval it estimates the expected cumulative size of future differentials vs a new full checkpoint and picks the cheaper</td></tr>
</tbody></table></div>
<figure class="fig"><div class="stage">
<svg viewBox="0 0 600 210" width="600" height="210" role="img" aria-label="Write bandwidth per checkpoint interval: one-shot grows, intermittent resets, consecutive stays small">
  <line x1="50" y1="170" x2="540" y2="170" class="s-line w1"/><line x1="50" y1="170" x2="50" y2="20" class="s-line w1"/>
  <path d="M60 150 L 100 140 L 140 128 L 180 116 L 220 104 L 260 92 L 300 80 L 340 70 L 380 60 L 420 50 L 460 42 L 500 34" class="f-none s-m w2"/>
  <path d="M60 150 L 100 140 L 140 128 L 180 116 L 220 30 L 260 140 L 300 128 L 340 116 L 380 30 L 420 140 L 460 128 L 500 116" class="f-none s-v w2"/>
  <path d="M60 152 L 100 152 L 140 151 L 180 152 L 220 151 L 260 152 L 300 151 L 340 152 L 380 151 L 420 152 L 460 151 L 500 152" class="f-none s-c w2"/>
  <g class="t-sm"><text x="295" y="196" text-anchor="middle" class="t-mut">checkpoint interval →</text><text x="20" y="95" text-anchor="middle" class="t-mut" transform="rotate(-90 20 95)">write BW (% of model)</text>
  <text x="506" y="46" class="t-m">one-shot</text><text x="232" y="22" class="t-v">intermittent (full snapshot)</text><text x="505" y="160" class="t-c">consecutive</text></g>
</svg></div><figcaption>Schematic of the lecture's comparison. Consecutive increments write little each time but their stored total grows without bound; one-shot and intermittent keep storage bounded.</figcaption></figure>
<h3>Quantized checkpoints</h3>
<p>Store checkpoint weights with fewer bits, without hurting training accuracy. Take the values 0.21, −0.31, 0.03, 0.01, −0.05 with a few levels (the slide shows 3-bit codes 000–111):</p>
<div class="grid2">
  <div class="tile"><h4>Uniform quantization</h4><p>Equal-width bins: (−0.31), (empty), (−0.05, 0.03, 0.01), (0.21). The crowded middle bin loses detail and one bin is wasted.</p></div>
  <div class="tile"><h4>Non-uniform quantization</h4><p>Bins adapted to the distribution: (−0.31), (−0.05), (0.03, 0.01), (0.21). The same number of levels separates the values better.</p></div>
</div>
<div class="box insight" data-t="Further reading named in the lecture"><p>Logging-based checkpointing, parallel recovery for multi-GPU training, and persistent memory (PM) for checkpoints. Papers: <i>Swift: Expedited Failure Recovery for Large-scale DNN Training</i> (arXiv 2023) and <i>GPM: Leveraging Persistent Memory from a GPU</i> (ASPLOS'22).</p></div>`
    }
  ],
  takeaways: [
    'Checkpoints protect long jobs against crashes, migration and spot pre-emption; they also serve migration, snapshots and transfer learning.',
    'Synchronous and epoch-level checkpointing is too costly and too coarse; CheckFreq makes iteration-level checkpoints cheap.',
    'Checkpoint = snapshot() (GPU → CPU) + persist() (CPU → disk); pipelining both lets only the next weight update wait.',
    'GPU-side snapshots are up to 10× cheaper when spare GPU memory exists.',
    'The resumable data iterator saves the seed and items consumed so every epoch still sees each item exactly once.',
    'CheckFreq overhead ≤ ~3.5% (vs 20–70%); recovery falls from hours to seconds.',
    'Check-N-Run: differential checkpoints exploit sparse embedding updates (intermittent full snapshots bound size); quantized checkpoints cut storage, non-uniform bins fit the distribution.'
  ],
  numbers: [
    ['Baseline checkpoint overhead at fine frequency', '20–70%', 'of training time'],
    ['CheckFreq overhead', '≤ ~3.5%', ''],
    ['GPU snapshot speed-up', 'up to 10×', 'vs CPU snapshot'],
    ['Persist pipelining alone', '~2× lower cost', 'still stalls'],
    ['Recovery ResNet-50', '2100 s → 24 s', 'epoch-based → CheckFreq'],
    ['Recovery VGG-16', '5700 s → 25 s', ''],
    ['Recovery BERT', '4920 s → 85 s', ''],
    ['Model modified per interval (recsys)', '~10–35%', 'Check-N-Run motivation'],
    ['Consecutive incremental storage', '~400% of model', 'grows without bound']
  ],
  quiz: [
    { q: 'What does snapshot() do in CheckFreq?', o: ['Writes weights to disk', 'Copies weights from GPU to CPU memory', 'Compresses gradients', 'Restarts training'], a: 1, why: 'persist() then writes the CPU copy to persistent storage.' },
    { q: 'With snapshot and persist both pipelined, what must wait for the snapshot to finish?', o: ['The next forward pass', 'The next backward pass', 'The next weight update', 'Nothing'], a: 2, why: 'Updating weights mid-copy would mix old and new values.' },
    { q: 'Why is epoch-level checkpointing no longer enough?', o: ['Disks got slower', 'Epochs are longer and interruptions (spot VMs) more frequent', 'GPUs got smaller', 'It is too accurate'], a: 1, why: 'Lost work per failure grows with epoch length.' },
    { q: 'What does the resumable data iterator store?', o: ['All gradients', 'The random seed and the number of items consumed', 'The model architecture', 'A copy of the dataset'], a: 1, why: 'So the rest of the shuffled epoch can be replayed exactly.' },
    { q: 'After a crash following items 1, 5, 8, 2 of order 1 5 8 2 6 4 7 3, CheckFreq resumes with…', o: ['1 5 8 2', '6 4 7 3', 'a fresh shuffle', '3 7 4 6'], a: 1, why: 'It continues the same epoch order from where it stopped.' },
    { q: 'CheckFreq\'s overhead on training time is about…', o: ['20–70%', '≤ 3.5%', '10×', '50%'], a: 1, why: 'Versus 20–70% for baseline checkpointing at the same frequency.' },
    { q: 'Why does differential checkpointing suit recommendation models?', o: ['They are small', 'Each iteration modifies only a small part of the embedding tables', 'They use FP32', 'They never change'], a: 1, why: 'Sparse features touch few embedding rows per iteration.' },
    { q: 'Main drawback of consecutive incremental checkpoints?', o: ['Each checkpoint is large', 'All increments must be kept and applied recursively on recovery', 'They lose accuracy', 'They need GPUs'], a: 1, why: 'Storage grows without bound and recovery needs every increment.' },
    { q: 'Intermittent differential checkpointing decides when to take a full checkpoint by…', o: ['A fixed timer', 'Comparing expected future differential size with a new full checkpoint', 'Random choice', 'User request'], a: 1, why: 'It picks whichever is expected to be cheaper.' },
    { q: 'Non-uniform quantization of checkpoints…', o: ['uses equal-width bins', 'adapts bins to the value distribution', 'stores FP32', 'drops small values'], a: 1, why: 'Bins follow the data, so the same bits separate values better.' }
  ],
  cards: [
    { f: 'Why checkpoint', b: 'Crashes, migration, spot pre-emption wipe in-memory weights; resume from the last checkpoint.' },
    { f: 'CheckFreq mechanism', b: 'Two-phase snapshot (GPU→CPU) + persist (CPU→disk), pipelined with training.' },
    { f: 'CheckFreq policy', b: 'Online profiling picks the initial frequency; adaptive rate tuning handles interference.' },
    { f: 'Pipelined snapshot rule', b: 'Next F and B run during the snapshot; only the weight update waits.' },
    { f: 'Resumable data iterator', b: 'Save seed + items consumed; each epoch sees every item exactly once.' },
    { f: 'CheckFreq results', b: 'Overhead ≤ ~3.5% (vs 20–70%); recovery hours → seconds.' },
    { f: 'Check-N-Run', b: 'Differential checkpoints (write bandwidth) + quantized checkpoints (size) for recommender models.' },
    { f: 'Differential variants', b: 'One-shot (grows), consecutive incremental (unbounded storage, recursive recovery), intermittent (periodic full snapshot).' }
  ]
});

// Local numeric parity/latency probe. This does not benchmark an iPhone/browser.
const fs = require('node:fs');
const {performance} = require('node:perf_hooks');
const ort = require('onnxruntime-web');
const [modelPath, inputPath, boxesPath, scoresPath, reportPath] = process.argv.slice(2);
if (!reportPath) throw Error('Usage: node probe_google_wasm.cjs MODEL INPUT_FLOAT32 BOXES_FLOAT32 SCORES_FLOAT32 REPORT_JSON');
function floats(path) {
  const bytes = fs.readFileSync(path);
  if (bytes.byteLength % 4) throw Error('Float32 file has an invalid byte count');
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
(async () => {
  ort.env.wasm.numThreads = 1;
  const values = floats(inputPath);
  if (values.length !== 300 * 300 * 3 || values.some(value => !Number.isFinite(value) || value < 0 || value > 1))
    throw Error('Expected RGB float32 [1,300,300,3] values in 0..1');
  const start = performance.now();
  const session = await ort.InferenceSession.create(new Uint8Array(fs.readFileSync(modelPath)),
    {executionProviders: ['wasm'], graphOptimizationLevel: 'all'});
  try {
    const loadMs = performance.now() - start;
    const input = new ort.Tensor('float32', values, [1,300,300,3]);
    const times = []; let output;
    for (let i = 0; i < 4; i++) {
      const t = performance.now();
      output = await session.run({'hub_input/image_tensor:0': input});
      times.push(performance.now() - t);
    }
    const errors = [];
    for (const [name, path] of [['unidoors_boxes:0', boxesPath], ['unidoors_scores:0', scoresPath]]) {
      const tensor = output[name], expected = floats(path);
      if (!tensor || tensor.data.length !== expected.length) throw Error('Output shape mismatch');
      let maximum = 0;
      for (let i = 0; i < expected.length; i++) {
        if (!Number.isFinite(tensor.data[i]) || !Number.isFinite(expected[i])) throw Error('Nonfinite output');
        maximum = Math.max(maximum, Math.abs(tensor.data[i] - expected[i]));
      }
      if (maximum > 1e-4) throw Error('WASM numeric parity failed: ' + maximum);
      errors.push({output: name, max_abs_error: maximum, shape: tensor.dims});
    }
    const report = {runtime: 'onnxruntime-web WASM SIMD, Node.js host, single thread',
      model_bytes: fs.statSync(modelPath).size, load_ms: loadMs, inference_ms: times,
      parity: errors, phone_benchmark: false,
      network_isolation_requested_by_runner: process.env.DOORLIVE_NETWORK_ISOLATED === '1'};
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await session.release(); }
})().catch(error => {console.error(error); process.exitCode = 1;});

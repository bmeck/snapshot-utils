import {
  Worker,
  receiveMessageOnPort,
  MessageChannel
} from 'worker_threads';
import {
  open as inspectorOpen,
  url as inspectorUrl,
  waitForDebugger as inspectorWaitForDebugger
} from 'inspector';

const sab = new SharedArrayBuffer(4);
const lock = new Int32Array(sab);
const {
  port1: mainPort,
  port2: workerPort
} = new MessageChannel();

inspectorOpen(0, '127.0.0.1', false);
const worker = new Worker(
  new URL('snapshot-worker.js', import.meta.url),
  {
    workerData: {
      lock,
      workerPort,
      inspectorUrl: inspectorUrl()
    },
    transferList: [workerPort]
  }
);
inspectorWaitForDebugger();
worker.unref();
const arg = {method: null, params: null};
const api = (method, params) => {
  worker.ref();
  let exception;
  let result;
  let ret;
  try {
    arg.method = method;
    arg.params = params;
    mainPort.postMessage(arg);
    while (true) {
      lock[0] = 1;
      Atomics.notify(lock, 0, 1);
      Atomics.wait(lock, 0, 1);
      ret = receiveMessageOnPort(mainPort).message;
      if (ret.log) {
        console.log(ret.log);
        ret = null;
      } else if (ret.exception) {
        exception = ret.exception;
        ret = null;
        throw exception;
      } else {
        result = ret.result;
        ret = null;
        return result;
      }
    }
  } finally {
    worker.unref();
  }
};

export const takeSnapshot = api.bind(null, 'snapshot');
export const newNodes = api.bind(null, 'newNodes');
export const inspectById = api.bind(null, 'inspectById');
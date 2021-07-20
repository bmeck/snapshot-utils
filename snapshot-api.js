import {
  Worker,
  receiveMessageOnPort,
  MessageChannel
} from 'worker_threads';
import {
  close as inspectorClose,
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

inspectorOpen(9229, '127.0.0.1', false);
let worker = new Worker(
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
let reifyValueCell = null;
const dirOptions = {depth: null,maxStringLength:null,maxArrayLength: null};
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
      reifyValueCell = null;
      lock[0] = 1;
      Atomics.notify(lock, 0, 1);
      Atomics.wait(lock, 0, 1);
      ret = receiveMessageOnPort(mainPort).message;
      if (ret.close) {
        worker.unref();
        worker = null;
        inspectorClose();
        return true;
      } else if (ret.log) {
        console.dir(ret.log, dirOptions);
        ret = null;
      } else if (ret.exception) {
        exception = ret.exception;
        ret = null;
        throw exception;
      } else {
        result = ret.result;
        ret = null;
        return reifyValueCell !== null ? reifyValueCell : result;
      }
    }
  } finally {
    if (worker) worker.unref();
  }
};

export const takeSnapshot = api.bind(null, 'snapshot');
export const newNodes = api.bind(null, 'newNodes');
export const inspectById = api.bind(null, 'inspectById');
export const inspectByIndex = api.bind(null, 'inspectByIndex');
export const readStringById = api.bind(null, 'readStringById');
export const reifyById = api.bind(null, 'reifyById');
export const retainers = api.bind(null, 'retainers');
export const containingClosures = api.bind(null, 'containingClosures');
export const getPropertiesById = api.bind(null, 'getPropertiesById');
export const getScriptById = api.bind(null, 'getScriptById');
export const getFunctionLocation = api.bind(null, 'getFunctionLocation');
export const close = api.bind(null, 'close');
process.on('exit', () => {
  if (worker) close()
});

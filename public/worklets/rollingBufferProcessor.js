/**
 * AudioWorklet Processor for Rolling Audio Buffer
 * 
 * Forwards PCM audio samples to the main thread for ring buffer storage.
 * This processor does not maintain state - it just forwards samples.
 */

class RollingBufferProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        // Get input channel 0 (mono)
        const input = inputs[0];
        if (input && input.length > 0) {
            const inputChannel = input[0];
            if (inputChannel && inputChannel.length > 0) {
                // Copy samples to a new Float32Array and send to main thread
                const samples = new Float32Array(inputChannel);
                this.port.postMessage({ samples });
            }
        }
        
        // Return true to keep processor alive
        return true;
    }
}

registerProcessor('rolling-buffer-processor', RollingBufferProcessor);


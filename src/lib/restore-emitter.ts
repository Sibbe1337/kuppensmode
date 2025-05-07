import EventEmitter from 'events';

// Create a single, shared instance of EventEmitter
const restoreEmitter = new EventEmitter();

// Optional: Increase the default listener limit if you expect many concurrent restores/listeners
// restoreEmitter.setMaxListeners(50); 

console.log("Shared Restore Event Emitter instance created.");

export default restoreEmitter; 
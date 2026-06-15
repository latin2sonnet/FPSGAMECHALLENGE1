import { io } from 'socket.io-client';

const socket = io('https://fpsgamechallenge1.onrender.com', { timeout: 10000 });
let passed = false;

socket.on('connect', () => {
  console.log('CONNECTED');
  socket.emit('join', { name: 'TestBot' });
});

socket.on('joined', (data) => {
  console.log('JOINED', data);
  passed = true;
  socket.disconnect();
});

socket.on('connect_error', (err) => {
  console.error('CONNECT_ERROR', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('DISCONNECTED', reason);
});

setTimeout(() => {
  socket.disconnect();
  console.log(passed ? 'TEST PASSED' : 'TEST FAILED');
  process.exit(passed ? 0 : 1);
}, 15000);

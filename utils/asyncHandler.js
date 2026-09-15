// Express 4 does not catch rejections from async route handlers — an
// unhandled one becomes a process-level unhandled rejection, which crashes
// the whole server (taking down every user, not just the failing request).
// Wrapping every handler here forwards the error to server.js's centralized
// error handler instead, so a bad request degrades to a clean 500.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;

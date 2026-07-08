'use strict';

// Native open-dialog options for picking a local model file (.gguf) from the
// Settings model-path fields. Kept pure so the filter/props contract is
// unit-testable without spinning up an Electron window.
function modelFileDialogOptions(defaultPath) {
  const options = {
    title: 'Choose a model file',
    filters: [
      { name: 'Model files', extensions: ['gguf'] },
      { name: 'All files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  };
  if (defaultPath) options.defaultPath = defaultPath;
  return options;
}

module.exports = { modelFileDialogOptions };

// Which comment style a file uses, decided by its extension or name.

const STYLE_BY_EXTENSION = {
  slash: [
    'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts', 'java', 'kt', 'kts', 'scala',
    'go', 'rs', 'swift', 'dart', 'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'php', 'groovy',
  ],
  hash: [
    'py', 'rb', 'sh', 'bash', 'zsh', 'yml', 'yaml', 'toml', 'tf', 'r', 'pl', 'ex', 'exs',
    'dockerfile',
  ],
  dash: ['sql', 'lua', 'hs'],
  text: ['md', 'mdx', 'txt'],
};

function baseName(path) {
  return path.split('/').pop();
}

export function getExtension(path) {
  const name = baseName(path);
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

export function getLanguage(path) {
  if (baseName(path) === 'Dockerfile') {
    return { style: 'hash' };
  }
  const extension = getExtension(path);
  for (const style of Object.keys(STYLE_BY_EXTENSION)) {
    if (STYLE_BY_EXTENSION[style].includes(extension)) {
      return { style };
    }
  }
  return null;
}

export function isTestFile(path) {
  const name = baseName(path);
  if (name.includes('.test.') || name.includes('.spec.')) {
    return true;
  }
  const folders = path.split('/').slice(0, -1);
  return folders.includes('__tests__') || folders.includes('test') || folders.includes('tests');
}

export function isExampleFile(path) {
  const parts = baseName(path).toLowerCase().split('.');
  return parts.includes('example') || parts.includes('sample');
}

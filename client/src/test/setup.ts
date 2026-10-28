import '@testing-library/jest-dom';

// JSDOM scroll mocks
Element.prototype.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

declare module 'dompurify' {
    const DOMPurify: {
      sanitize: (input: string) => string;
    }
    export default DOMPurify
  }

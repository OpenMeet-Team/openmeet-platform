declare module 'dompurify' {
    const DOMPurify: {
      sanitize: (input: string | Promise<string>) => string;
    }
    export default DOMPurify
  }

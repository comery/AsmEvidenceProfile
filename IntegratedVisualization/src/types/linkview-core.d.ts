declare module '@linkview/linkview-core' {
  export interface Options {
    [key: string]: any;
  }
  
  export function main(options: Options): Promise<string>;
  
  const linkviewCore: {
    main: typeof main;
  };
  
  export default linkviewCore;
}


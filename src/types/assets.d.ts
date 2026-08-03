declare module "*.csv?url" {
  const url: string;
  export default url;
}

declare module "*.csv?raw" {
  const contents: string;
  export default contents;
}

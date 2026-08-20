const routeColors = [
  "#c1121f",
  "#1f77b4",
  "#2ca02c",
  "#ffb000",
  "#7b2cbf",
  "#009688",
  "#e76f51",
  "#4d908e",
  "#f72585",
  "#4361ee",
];

export const getStorkRouteColor = (index: number) =>
  routeColors[index % routeColors.length] ?? "#c1121f";

const [serviceName, ...rest] = process.argv.slice(2);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const verbose = rest.includes("--verbose");

await delay(20);

console.log(
  JSON.stringify({
    service: serviceName,
    status: "healthy",
    verbose
  })
);

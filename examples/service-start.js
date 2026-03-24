const [name, ...rest] = process.argv.slice(2);

const parsed = {
  name,
  port: "3000",
  tags: []
};

for (let index = 0; index < rest.length; index += 1) {
  const token = rest[index];
  if (token === "--port") {
    parsed.port = rest[index + 1];
    index += 1;
    continue;
  }
  if (token === "--tag") {
    parsed.tags = rest.slice(index + 1);
    break;
  }
}

console.log(JSON.stringify(parsed));

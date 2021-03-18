const { ApolloServer, gql } = require("apollo-server");
const typeDefs = require("./db/schema.graphql");
const resolvers = require("./db/resolvers");
const connectDB = require("./config/db");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "variables.env" });

connectDB();

//server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    const token = req.headers["authorization"] || "";

    if (token) {
      try {
        const user = jwt.verify(token, process.env.SECRET);
        return { user };
      } catch (error) {
        // console.error(error);
      }
    }
  },
});

server.listen().then(({ url }) => {
  console.log(`Server ready at: ${url} `);
});

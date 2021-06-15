const User = require("../models/User");
const Product = require("../models/Product");
const Client = require("../models/Client");
const Order = require("../models/Order");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "variables.env" });

const createToken = (user, secret, expiresIn) => {
  const { id, email, name, lastname } = user;
  return jwt.sign({ id }, secret, { expiresIn });
};

const resolvers = {
  Query: {
    getAuthUser: async (_, { token }, ctx, info) => {
      const userId = await jwt.verify(token, process.env.SECRET);

      return userId;
    },
    getProducts: async () => {
      try {
        const products = await Product.find({});
        return products;
      } catch (error) {
        console.error(error);
      }
    },
    getProductByID: async (_, { id }) => {
      const product = await Product.findById(id);

      if (!product) {
        throw new Error("Product doesn't exist");
      }

      return product;
    },
    getClients: async () => {
      try {
        const clients = await Client.find({});
        return clients;
      } catch (error) {
        console.error(error);
      }
    },
    getClientsBySalesPerson: async (_, {}, ctx) => {
      try {
        const clients = await Client.find({ seller: ctx.user.id.toString() });
        return clients;
      } catch (error) {
        console.error(error);
      }
    },
    getClientByID: async (_, { id }, ctx) => {
      // check if the user exists
      const client = await Client.findById(id);
      if (!client) throw new Error("client not found");

      // check if the user exists
      if (client.seller.toString() !== ctx.user.id) {
        if (!client) throw new Error("need credentials for this action");
      }

      return client;
    },
    getOrders: async () => {
      try {
        const orders = await Order.find({});
        return orders;
      } catch (error) {
        console.error(error);
      }
    },
    getOrdersBySalesPerson: async (_, {}, ctx) => {
      try {
        const orders = await Order.find({ salesPerson: ctx.user.id });
        return orders;
      } catch (error) {
        console.error(error);
      }
    },
    getOrderByID: async (_, { id }, ctx) => {
      const order = await Order.findById(id);

      if (!order) {
        throw new Error("unable order");
      }

      if (order.salesPerson.toString() !== ctx.user.id) {
        throw new Error("bad credentials");
      }

      return order;
    },
    getOrdersByStatus: async (_, { status }, ctx) => {
      const orders = await Order.find({ salesPerson: ctx.user.id, status });
      return orders;
    },
    getTopClients: async () => {
      const clients = await Order.aggregate([
        { $match: { status: "COMPLETED" } },
        {
          $group: {
            _id: "$client",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "clients",
            localField: "_id",
            foreignField: "_id",
            as: "client",
          },
        },
        {
          $limit: 10,
        },
        {
          $sort: {
            total: -1,
          },
        },
      ]);
      return clients;
    },
    getTopSalesPerson: async () => {
      const salesPersons = await Order.aggregate([
        { $match: { status: "COMPLETED" } },
        {
          $group: {
            _id: "$salesPerson",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "salesPerson",
          },
        },
        {
          $limit: 3,
        },
        {
          $sort: {
            total: -1,
          },
        },
      ]);

      return salesPersons;
    },
    searchProductByName: async (_, { txt }) => {
      const products = await Product.find({ $text: { $search: txt } }).limit(
        10
      );
      return products;
    },
  },
  Mutation: {
    addNewUser: async (_, { input }, ctx, info) => {
      const { email, password } = input;

      //check if the user exist
      const userExist = await User.findOne({ email });

      if (userExist) throw new Error("registered user");

      // hashing password
      const salt = await bcryptjs.genSalt(10);
      input.password = await bcryptjs.hash(password, salt);

      try {
        console.log(input);
        const user = new User(input);
        user.save();
        return user;
      } catch (error) {
        console.error(error);
      }
    },

    authUser: async (_, { input }, ctx, info) => {
      const { email, password } = input;

      // check if user exists
      const userExist = await User.findOne({ email });
      if (!userExist) throw new Error("user doesn't exists");

      // validate password
      const correctPassword = await bcryptjs.compare(
        password,
        userExist.password
      );

      if (!correctPassword) {
        throw new Error("invalid password");
      }

      //token
      return {
        token: createToken(userExist, process.env.SECRET, "24h"),
      };
    },

    addNewProduct: async (_, { input }, ctx, info) => {
      console.log(input);
      try {
        const product = new Product(input);
        const result = await product.save();
        return result;
      } catch (error) {
        console.error(error);
      }
    },

    updateProduct: async (_, { id, input }) => {
      let product = Product.findById(id);

      console.log(product);

      if (!product) throw new Error("Product not found");

      product = await Product.findOne({ _id: id }, input, { new: true });

      return product;
    },

    deleteProduct: async (_, { id }) => {
      let product = await Product.findById(id);

      if (!product) {
        throw new Error("Product not found");
      }

      await Product.findOneAndDelete({ _id: id });

      return "Product Deleted";
    },

    addClient: async (_, { input }, ctx) => {
      //verify if client exists
      const { email } = input;
      const clientExists = await Client.findOne({ email });

      if (clientExists) throw new Error("client previously registered");

      const newClient = new Client(input);
      //assign sales person
      newClient.seller = ctx.user.id;
      //store in DB
      try {
        const result = await newClient.save();
        return result;
      } catch (error) {
        console.error(error);
      }
    },

    updateClient: async (_, { id, input }, ctx) => {
      let client = Client.findById(id);

      if (!client) throw new Error("Product not found");

      //TODO: validate user

      client = await Client.findOneAndUpdate({ _id: id }, input, { new: true });

      return client;
    },

    deleteClient: async (_, { id }, ctx) => {
      let client = Client.findById(id);

      if (!client) throw new Error("Product not found");

      // check if the user exists
      if (ctx.user.id) {
        if (!client) throw new Error("need credentials for this action");
      }

      await Client.findByIdAndDelete({ _id: id });
      return "Client Deleted";
    },

    newOrder: async (_, { input }, ctx) => {
      const { client } = input;
      //verify client
      let clientExists = await Client.findById(client);

      if (!clientExists) throw new Error("Product not found");
      //verify sales

      if (clientExists.seller.toString() !== ctx.user.id) {
        throw new Error("bad credentials");
      }

      //verify stock

      for await (const good of input.order) {
        const { id } = good;

        const product = await Product.findById(id);

        if (good.quantity > product.stock) {
          throw new Error(`${product.name} exceed the available quantity`);
        } else {
          //update stock
          product.stock = product.stock - good.quantity;
          await product.save();
        }
      }

      //create new order
      const newOrder = new Order(input);

      //assign sales person
      newOrder.salesPerson = ctx.user.id;

      //save
      const result = await newOrder.save();
      return result;
    },

    updateOrder: async (_, { id, input }, ctx) => {
      const { client } = input;

      const orderExists = await Order.findById(id);
      if (!orderExists) {
        throw new Error("Product not found");
      }

      const clientExists = await Client.findById(client);
      if (!clientExists) {
        throw new Error("client not found");
      }

      if (clientExists.seller.toString() !== ctx.user.id) {
        throw new Error("bad credentials");
      }

      if (input.order) {
        for await (const good of input.order) {
          const { id } = good;

          const product = await Product.findById(id);

          if (good.quantity > product.stock) {
            throw new Error(`${product.name} exceed the available quantity`);
          } else {
            //update stock
            product.stock = product.stock - good.quantity;
            await product.save();
          }
        }
      }
      const result = await Order.findByIdAndUpdate({ _id: id }, input, {
        new: true,
      });
      return result;
    },

    deleteOrder: async (_, { id }, ctx) => {
      let order = Order.findById(id);

      if (!order) throw new Error("Order not found");

      // check if the user exists
      if (order.salesPerson.toString() !== ctx.user.id) {
        throw new Error("need credentials for this action");
      }

      await Order.findByIdAndDelete({ _id: id });
      return "Order Deleted";
    },
  },
};

module.exports = resolvers;

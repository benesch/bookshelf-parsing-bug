var _ = require('lodash')
  , when = require('when')
  , pipeline = require('when/pipeline')
  , inflection = require('inflection');

var Bookshelf = require('bookshelf').initialize({
  client:  'mysql',
  connection: {
    host:    '127.0.0.1',
    user:    'root',
    password: '',
    database: 'bookshelf-parsing-bug',
    charset: 'utf8'
  }
});

var FormatModel = Bookshelf.Model.extend({
  // Convert fields to snake_case on save
  format: function (attributes) {
    return _.reduce(attributes, function (memo, value, key) {
      memo[inflection.underscore(key)] = value;
      return memo;
    }, {});
  },

  // Convert fields to camelCase on load
  parse: function(attributes) {
    return _.reduce(attributes, function (memo, value, key) {
      memo[inflection.camelize(key, true)] = value;
      return memo;
    }, {});
  }
});

var Comment = FormatModel.extend({
  tableName: 'comments'
});

var Post = FormatModel.extend({
  tableName: 'posts',

  comments: function () {
    return this.hasMany(Comment);
  },

  customComments: function () {
    return this.hasMany(Comment, 'postId');
  }
});

var knex = Bookshelf.knex;
var schema = knex.schema;

var commands = [
  function () { return schema.dropTableIfExists('comments'); },
  function () { return schema.dropTableIfExists('posts') },

  function () {
    return schema.createTable('posts', function (table) {
      table.increments('id').primary();
      table.string('name_of_post');
      table.timestamps();
    });
  },

  function () {
    return schema.createTable('comments', function (table) {
      table.increments('id').primary();
      table.string('comment_text');
      table.integer('post_id');
      table.timestamps();
    });
  },

  function () {
    return when.all([
      knex('posts').insert({
        name_of_post: 'Really complicated source code',
        created_at: new Date(), updated_at: new Date()
      }),
      knex('comments').insert({
        comment_text: 'BUG BUG BUG BUUG',
        post_id: 1,
        created_at: new Date(), updated_at: new Date()
      }),
      knex('comments').insert({
        comment_text: 'Read the source, Luke.',
        post_id: 1,
        created_at: new Date(), updated_at: new Date()
      }),
    ]);
  },

  function () {
    console.log('Using #related to fetch all comments of post 1');

    return Post.forge({ id: 1 }).related('comments').fetch();
  },

  function (comments) {
    console.log(comments.toJSON());
  },

  function () {
    console.log('\nEager loading comments of post 1');

    return Post.forge({ id: 1 }).fetch({ withRelated: 'comments' });
  },

  function (comments) {
    console.log(comments.toJSON());
  },

  function () {
    console.log('\nEager loading customComments (foreign key "postId") of post 1');

    return Post.forge({ id: 1 }).fetch({ withRelated: 'customComments' });
  },

  function (comments) {
    console.log(comments);
  }
];

pipeline(commands)
  .otherwise(function (error) {
    console.log(error);
  });


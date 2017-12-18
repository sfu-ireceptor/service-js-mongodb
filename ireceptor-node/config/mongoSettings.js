module.exports = {

    // MongoDB Settings
    hostname: process.env.MONGODB_HOST,
    dbname: process.env.MONGODB_DB,
    username: process.env.MONGODB_GUEST_USER,
    usersecret: process.env.MONGODB_GUEST_SECRET,
};

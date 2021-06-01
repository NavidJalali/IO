const IO = require("./lib/index").IO
const RetryPolicies = require("./lib/index").RetryPolicies

const t = new IO((resolve, reject) => {
    resolve("in_progress")
})
.retry(RetryPolicies.spaced(100, 3))
.tap(console.log)
.run()
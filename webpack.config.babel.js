import {configureNodeLib} from "./src"

export default configureNodeLib({
  documentation: {babel: true},
  publishimo: {fetchGithub: true},
  extra: {
    devtool: false,
  },
})
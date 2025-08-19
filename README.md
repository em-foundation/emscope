# emscope

# Linux installation

## Install Joulescope

Download Ubuntu 24.04LTS version from https://www.joulescope.com/pages/downloads

Once the .tar.gz file is downloaded, do the below -- adjusting as appropriate

``` bash
tar_file=$HOME/Downloads/joulescope_1_3_6.tar.gz # set the actual file path here
output_folder=/opt/joulescope                    # set the actual output folder here

sudo mkdir -p ${output_folder}
sudo tar -xf ${tar_file} --strip-components=1 --no-same-owner -C ${output_folder}
export PATH=${output_folder}:$PATH               # recommend adding this line to your $HOME/.bashrc file
```

## Building emscope package for npm registry

``` bash
git clone git@github.com:em-foundation/emscope.git

version=$(cat package.json | jq -r .version)
release_tag=resources                            # set the actual release tag to use
npm_package_repo=em-foundation/npm-packages      # set the actual npm registry repo to use

cd emscope
npm install
npm run build
rm -r node_modules
npm pack
gh release upload ${release_tag} emscope-${version}.tgz --repo ${npm_package_repo}
rm emscope-${version}.tgz

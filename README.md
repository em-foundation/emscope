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

## Install emscope

``` bash
git clone git@github.com:em-foundation/emscope.git
cd emscope
npm install
npm run build
sudo mkdir -p /opt/emscope
sudo cp -r node_modules /opt/emscope/
sudo cp -r out/Main.js /opt/emscope/emscope
export PATH=/opt/emscope:$PATH                 # recommend adding this line to your $HOME/.bashrc file
```

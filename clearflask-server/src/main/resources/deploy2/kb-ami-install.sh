#!/usr/bin/env bash

set -ex

sudo add-apt-repository universe
sudo apt update
sudo apt install -y mc ruby

sudo gem install kpm
mkdir install && cd install

#  ssh -i /c/personal/ssh/MatusWorky.pem ec2-user@107.22.155.188
